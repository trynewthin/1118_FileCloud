import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Folder, FileIcon, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/common/GlassCard";
import { searchFiles, type FileSearchResult } from "@/lib/api/files";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId: number;
}

// 格式化文件大小
const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export function SearchDialog({ open, onOpenChange, libraryId }: SearchDialogProps) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // 关闭时重置状态
      setKeyword("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  // 防抖搜索
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await searchFiles({
        libraryId,
        keyword: q.trim(),
        limit: 50,
      });
      setResults(res.items);
    } catch (err) {
      console.error("搜索失败:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [libraryId]);

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

  // 点击搜索结果
  const handleResultClick = (item: FileSearchResult) => {
    // 先关闭对话框
    onOpenChange(false);
    
    // 延迟导航，确保 Dialog 关闭动画完成后再跳转
    setTimeout(() => {
      if (item.isDirectory) {
        // 如果是目录，直接进入该目录
        navigate(`/files?libraryId=${libraryId}&parentId=${item.id}`);
      } else {
        // 如果是文件，进入文件预览页（注意：预览路由是 /preview/:id，不带 /files 前缀）
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] h-[480px] flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            搜索文件
          </DialogTitle>
        </DialogHeader>

        {/* 搜索输入框 */}
        <div className="relative">
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
                setSearched(false);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
                  <GlassCard
                    key={item.id}
                    variant="ghost"
                    className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleResultClick(item)}
                  >
                    <div className="flex items-center gap-3">
                      {/* 图标 */}
                      <div className={cn(
                        "shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                        item.isDirectory 
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      )}>
                        {item.isDirectory ? (
                          <Folder className="h-4 w-4" />
                        ) : (
                          <FileIcon className="h-4 w-4" />
                        )}
                      </div>
                      
                      {/* 名称和路径 */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.path}
                        </div>
                      </div>
                      
                      {/* 大小（仅文件） */}
                      {!item.isDirectory && item.size > 0 && (
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatSize(item.size)}
                        </div>
                      )}
                    </div>
                  </GlassCard>
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
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {results.length > 0 && `找到 ${results.length} 个结果`}
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            关闭
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
