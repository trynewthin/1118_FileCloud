/**
 * 全局搜索对话框
 * 支持跨文件库搜索，可选择搜索范围
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, HardDrive, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FileListItem } from "@/components/files/FileListItem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GlassButton } from "@/components/common/GlassButton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchUnifiedEntries, type UnifiedFileEntry, type LibraryStatus } from "@/lib/api/entries";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { cn } from "@/lib/utils";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 可选：初始限定的文件库 ID 列表
  initialLibraryIds?: number[];
}

export function GlobalSearchDialog({ 
  open, 
  onOpenChange,
  initialLibraryIds,
}: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const { items: libraries } = useFileLibraries({ autoRefresh: false });
  
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<UnifiedFileEntry[]>([]);
  const [involvedLibraries, setInvolvedLibraries] = useState<LibraryStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // 选中的文件库 ID（空数组表示搜索所有库）
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<number[]>(initialLibraryIds || []);
  const [filterOpen, setFilterOpen] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 使用 ref 保存最新的状态，避免 useCallback 依赖问题
  const selectedLibraryIdsRef = useRef(selectedLibraryIds);
  selectedLibraryIdsRef.current = selectedLibraryIds;
  const keywordRef = useRef(keyword);
  keywordRef.current = keyword;
  const searchedRef = useRef(searched);
  searchedRef.current = searched;
  // 保存 initialLibraryIds 的 ref，避免数组引用变化触发 useEffect
  const initialLibraryIdsRef = useRef(initialLibraryIds);
  initialLibraryIdsRef.current = initialLibraryIds;

  // 打开时聚焦输入框，仅在 open 变化时触发
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      // 重置选中的库（使用 ref 获取最新值）
      setSelectedLibraryIds(initialLibraryIdsRef.current || []);
    } else {
      // 关闭时重置状态
      setKeyword("");
      setResults([]);
      setInvolvedLibraries([]);
      setSearched(false);
    }
  }, [open]); // 仅依赖 open，不依赖 initialLibraryIds

  // 防抖搜索（使用 ref 获取最新的 selectedLibraryIds，避免依赖变化导致函数重建）
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setInvolvedLibraries([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const currentLibraryIds = selectedLibraryIdsRef.current;
      const res = await searchUnifiedEntries({
        keyword: q.trim(),
        libraryIds: currentLibraryIds.length > 0 ? currentLibraryIds : undefined,
        limit: 100,
      });
      setResults(res.items);
      setInvolvedLibraries(res.libraries);
    } catch (err) {
      console.error("搜索失败:", err);
      setResults([]);
      setInvolvedLibraries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 输入变化时防抖搜索
  const handleInputChange = (value: string) => {
    setKeyword(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      doSearch(value);
    }, 300);
  };

  // 切换文件库选择
  const toggleLibrary = (libraryId: number) => {
    setSelectedLibraryIds(prev => {
      const newIds = prev.includes(libraryId)
        ? prev.filter(id => id !== libraryId)
        : [...prev, libraryId];
      return newIds;
    });
  };

  // 选择/取消所有库
  const toggleAllLibraries = () => {
    if (selectedLibraryIds.length === libraries.length) {
      setSelectedLibraryIds([]);
    } else {
      setSelectedLibraryIds(libraries.map(l => l.id));
    }
  };

  // 文件库选择变化后重新搜索
  useEffect(() => {
    if (keywordRef.current.trim() && searchedRef.current) {
      doSearch(keywordRef.current);
    }
  }, [selectedLibraryIds, doSearch]);

  // 点击搜索结果
  const handleResultClick = (item: UnifiedFileEntry) => {
    onOpenChange(false);
    
    setTimeout(() => {
      if (item.is_directory) {
        navigate(`/files?libraryId=${item.library_id}&parentId=${item.id}`);
      } else {
        navigate(`/preview/${item.id}`);
      }
    }, 100);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && keyword.trim()) {
      doSearch(keyword);
    }
  };

  // 获取搜索范围描述
  const getSearchScopeText = () => {
    if (selectedLibraryIds.length === 0) {
      return "所有文件库";
    }
    if (selectedLibraryIds.length === 1) {
      const lib = libraries.find(l => l.id === selectedLibraryIds[0]);
      return lib?.display_name || "1 个文件库";
    }
    return `${selectedLibraryIds.length} 个文件库`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] h-[520px] flex flex-col"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            全局搜索
          </DialogTitle>
        </DialogHeader>

        {/* 搜索输入框 + 筛选按钮 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={keyword}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入关键词搜索..."
              className="pl-10 pr-10"
            />
            {keyword && (
              <button
                onClick={() => {
                  setKeyword("");
                  setResults([]);
                  setInvolvedLibraries([]);
                  setSearched(false);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* 文件库筛选按钮 */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <GlassButton
                glassVariant="lite"
                size="icon"
                className={cn(
                  "h-10 w-10 shrink-0",
                  selectedLibraryIds.length > 0 && "text-primary"
                )}
                title="选择搜索范围"
              >
                <Filter className="h-4 w-4" />
              </GlassButton>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2">
              <div className="space-y-2">
                <div className="text-sm font-medium px-2 py-1">搜索范围</div>
                
                {/* 全选/取消全选 */}
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                  onClick={toggleAllLibraries}
                >
                  <Checkbox
                    checked={selectedLibraryIds.length === 0 || selectedLibraryIds.length === libraries.length}
                    className="pointer-events-none"
                  />
                  <span className="text-sm">
                    {selectedLibraryIds.length === 0 ? "所有文件库" : "全选"}
                  </span>
                </div>
                
                <div className="border-t my-1" />
                
                {/* 文件库列表 */}
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {libraries.map(lib => (
                    <div
                      key={lib.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleLibrary(lib.id)}
                    >
                      <Checkbox
                        checked={selectedLibraryIds.length === 0 || selectedLibraryIds.includes(lib.id)}
                        className="pointer-events-none"
                      />
                      <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{lib.display_name}</span>
                      {!lib.is_online && (
                        <span className="text-xs text-muted-foreground">离线</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* 搜索范围提示 */}
        <div className="text-xs text-muted-foreground">
          搜索范围: {getSearchScopeText()}
        </div>

        {/* 搜索结果列表 */}
        <div className="flex-1 border rounded-md bg-muted/30 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                搜索中...
              </div>
            ) : results.length > 0 ? (
              <div className="p-2 space-y-1">
                {results.map((item) => (
                  <FileListItem
                    key={item.id}
                    entry={item}
                    onClick={() => handleResultClick(item)}
                    libraryOffline={!item.library_online}
                  />
                ))}
              </div>
            ) : searched ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                未找到匹配的文件
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                输入关键词开始搜索
              </div>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        {results.length > 0 && (
          <div className="text-xs text-muted-foreground pt-1">
            找到 {results.length} 个结果
            {involvedLibraries.length > 1 && ` (来自 ${involvedLibraries.length} 个文件库)`}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
