import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Folder, ChevronRight, Home, XIcon, Check, Search, X } from "lucide-react";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/dialog/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getEntry, listEntries, type FileEntry, type CopyEntryParams } from "@/lib/api/files";
import { moveCopyParams, submitMoveCopyEntries } from "./moveCopyForm";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
}

interface SearchResult {
  id: string;
  name: string;
  path: string;
}

interface MoveCopyDialogProps {
  mode: "move" | "copy";
  entry: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: FileEntry, params: CopyEntryParams) => Promise<void>;
  batchEntries?: FileEntry[];
}

export function MoveCopyDialog(props: MoveCopyDialogProps) {
  return <MoveCopyDialogContent key={`${props.open}-${props.mode}-${props.entry?.id}`} {...props} />;
}

function MoveCopyDialogContent({ mode, entry, open, onOpenChange, onSubmit, batchEntries }: MoveCopyDialogProps) {
  const [newName, setNewName] = useState(mode === "copy" ? entry?.original_name ?? "" : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourcePasswords, setSourcePasswords] = useState<Record<string, string>>({});
  const [targetPasswords, setTargetPasswords] = useState<Record<string, string>>({});
  const [unlockedPasswords, setUnlockedPasswords] = useState<Record<string, string>>({});
  const submitted = useRef(new Set<string>());
  const sourceEntries = batchEntries ?? (entry ? [entry] : []);
  const isBatch = !!batchEntries;

  // 文件夹选择器状态
  const [currentParentId, setCurrentParentId] = useState<string | null>(entry?.parent_id ?? null);
  const [items, setItems] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [folderReload, setFolderReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const targetId = selectedId === "__ROOT__" ? null : selectedId || currentParentId;
  const currentParentPassword = currentParentId ? unlockedPasswords[currentParentId] : undefined;
  const breadcrumbRequest = useRef(0);
  const searchRequest = useRef(0);
  const invalidateSearch = useCallback(() => { searchRequest.current++; }, []);
  const invalidateRequests = useCallback(() => {
    breadcrumbRequest.current++;
    searchRequest.current++;
  }, []);

  // 搜索状态
  const [searchMode, setSearchMode] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // 搜索文件夹
  const searchFolders = useCallback(async (keyword: string) => {
    if (!entry || !keyword.trim()) {
      setSearchResults([]);
      return;
    }
    const request = ++searchRequest.current;
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        keyword: keyword.trim(),
        excludeId: entry.id,
        limit: "20",
      });
      const res = await apiClient.get<{ items: SearchResult[] }>(
        `/files/library/${entry.library_id}/folders/search?${params.toString()}`
      );
      if (request === searchRequest.current) setSearchResults(res.items || []);
    } catch (err) {
      console.error(err);
      if (request === searchRequest.current) setSearchResults([]);
    } finally {
      if (request === searchRequest.current) setSearchLoading(false);
    }
  }, [entry]);

  // 加载当前目录的子文件夹
  useEffect(() => {
    if (!open || !entry) return;
    let active = true;
    const loadFolders = async () => {
      setFolderLoading(true);
      setFolderError("");
      try {
        const res = await listEntries({ libraryId: entry.library_id,
          parentId: currentParentId, password: currentParentPassword });

        if (!active) return;
        const dirs = res.items
          .filter((i) => i.is_directory && i.id !== entry.id) // 排除当前文件/文件夹本身
          .map((i) => ({
            id: i.id,
            name: i.original_name,
          }));

        // 根目录下增加一个显式的"根目录"虚拟项
        if (!currentParentId) {
          setItems([
            { id: "__ROOT__", name: "根目录（当前文件库）" },
            ...dirs,
          ]);
        } else {
          setItems(dirs);
        }
      } catch (err) {
        if (!active) return;
        console.error(err);
        setItems([]);
        setFolderError(err instanceof Error ? err.message : "目录加载失败");
      } finally {
        if (active) setFolderLoading(false);
      }
    };
    void loadFolders();
    return () => { active = false; };
  }, [open, entry, currentParentId, currentParentPassword, folderReload]);

  // 加载初始目录的祖先路径并加载文件夹列表
  const loadInitialBreadcrumbs = useCallback(async (parentId: string, name = "目标目录", password?: string) => {
    if (!entry) return;
    const request = ++breadcrumbRequest.current;
    // Navigation changes the destination before metadata resolves. A denied
    // password challenge must never redirect a transfer to the library root.
    setSelectedId(null);
    setCurrentParentId(parentId);
    setBreadcrumbs([{ id: parentId, name }]);
    try {
      const res = await getEntry(parentId, password);
      if (request !== breadcrumbRequest.current) return;
      if (res.ancestors && res.ancestors.length > 0) {
        const crumbs = [...res.ancestors, { id: parentId, name: res.entry.original_name }];
        setBreadcrumbs(crumbs);
        setCurrentParentId(parentId);
      } else {
        setBreadcrumbs([{ id: parentId, name: res.entry.original_name }]);
        setCurrentParentId(parentId);
      }
    } catch (err) {
      if (request !== breadcrumbRequest.current) return;
      setFolderError(err instanceof Error ? err.message : "目录加载失败");
    }
    // 设置完 currentParentId 后会触发 loadFolders
  }, [entry]);

  useEffect(() => {
    if (open && entry?.parent_id) void loadInitialBreadcrumbs(entry.parent_id);
    return invalidateRequests;
  }, [open, entry?.parent_id, loadInitialBreadcrumbs, invalidateRequests]);

  // 搜索关键词变化时防抖搜索
  useEffect(() => {
    if (!searchMode) return;
    invalidateSearch();
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    
    searchDebounceRef.current = setTimeout(() => {
      searchFolders(searchKeyword);
    }, 300);
    
    return () => {
      invalidateSearch();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchKeyword, searchMode, searchFolders, invalidateSearch]);

  // 进入搜索模式时聚焦输入框
  useEffect(() => {
    if (searchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchMode]);

  // 选择搜索结果：导航到该文件夹
  const handleSelectSearchResult = async (result: SearchResult) => {
    setSearchMode(false);
    setSearchKeyword("");
    setSearchResults([]);
    // 导航到搜索选中的文件夹，加载其祖先路径并设为当前目录
    await loadInitialBreadcrumbs(result.id, result.name, unlockedPasswords[result.id]);
  };

  const handleUnlockTarget = async () => {
    if (!targetId || loading) return;
    const password = targetPasswords[targetId] ?? "";
    setUnlockedPasswords(previous => ({ ...previous, [targetId]: password }));
    setFolderReload(previous => previous + 1);
    const name = items.find(item => item.id === targetId)?.name ??
      breadcrumbs.find(crumb => crumb.id === targetId)?.name ?? "目标目录";
    await loadInitialBreadcrumbs(targetId, name, password);
  };

  const handleEnter = (item: FolderItem) => {
    if (item.id === "__ROOT__") return; // 根目录虚拟项不能进入
    breadcrumbRequest.current++;
    setCurrentParentId(item.id);
    setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    setSelectedId(null);
  };

  const handleSubmit = async () => {
    if (!entry || loading) return;

    setLoading(true);
    setError("");
    try {
      if (sourceEntries.some(source => source.library_id !== entry.library_id)) {
        throw new Error("批量移动或复制只能选择同一文件库中的条目");
      }
      await submitMoveCopyEntries(sourceEntries, submitted.current, source =>
        onSubmit(source, moveCopyParams(source.id, targetId, sourcePasswords, targetPasswords,
          mode === "copy" && !isBatch ? newName || undefined : undefined)));
      toast.success(`${mode === "move" ? "移动" : "复制"}任务已提交`);
      onOpenChange(false);
    } catch (err: unknown) {
      const message = (err instanceof Error ? err.message : "") || "操作失败";
      setError(submitted.current.size ? `已提交 ${submitted.current.size} 项，重试只提交剩余条目。${message}` : message);
    } finally {
      setLoading(false);
    }
  };

  const title = isBatch 
    ? `批量${mode === "move" ? "移动" : "复制"} ${sourceEntries.length} 个项目`
    : (mode === "move" ? "移动文件" : "复制文件");

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!loading) onOpenChange(nextOpen); }}>
      <DialogContent className="sm:max-w-[500px] h-[750px] max-h-[90vh] flex flex-col" showCloseButton={false}>
        <GlassCard variant="lite" className="p-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isBatch 
                ? "选择目标文件夹" 
                : (entry?.is_directory ? "选择目标文件夹" : `${mode === "move" ? "移动" : "复制"} "${entry?.original_name}" 到：`)}
            </DialogDescription>
          </DialogHeader>
        </GlassCard>

        {/* 搜索栏 / 面包屑导航 */}
        <GlassCard variant="lite" className="px-3 py-2">
          <div className="flex items-center gap-1 text-sm overflow-x-auto">
          {searchMode ? (
            // 搜索模式
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                ref={searchInputRef}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索文件夹..."
                className="h-7 text-sm flex-1"
              />
              <GlassIconButton
                glassVariant="lite"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setSearchMode(false);
                  setSearchKeyword("");
                  setSearchResults([]);
                }}
              >
                <X className="h-4 w-4" />
              </GlassIconButton>
            </div>
          ) : (
            // 浏览模式
            <>
              <GlassIconButton
                glassVariant="lite"
                className="h-6 w-6 shrink-0" 
                onClick={() => {
                  breadcrumbRequest.current++;
                  setCurrentParentId(null);
                  setBreadcrumbs([]);
                  setSelectedId(null);
                }}
                title="返回根目录"
              >
                <Home className="h-4 w-4" />
              </GlassIconButton>
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground">/</span>
                  <button
                    type="button"
                    className={cn(
                      "text-xs px-1 py-0.5 rounded hover:bg-muted transition-colors truncate max-w-[120px]",
                      index === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                    onClick={() => {
                      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                      setBreadcrumbs(newBreadcrumbs);
                      breadcrumbRequest.current++;
                      setCurrentParentId(crumb.id);
                      setSelectedId(null);
                    }}
                    title={crumb.name}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
              {breadcrumbs.length === 0 && (
                <span className="text-xs text-muted-foreground ml-1">根目录</span>
              )}
              {/* 搜索按钮 */}
              <GlassIconButton
                glassVariant="lite"
                className="h-6 w-6 shrink-0 ml-auto"
                onClick={() => setSearchMode(true)}
                title="搜索文件夹"
              >
                <Search className="h-4 w-4" />
              </GlassIconButton>
            </>
          )}
          </div>
        </GlassCard>

        {/* 文件夹列表 / 搜索结果 */}
        <GlassCard variant="lite" className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto py-3 px-3 min-h-0">
          {searchMode ? (
            // 搜索结果
            searchLoading ? (
              <div className="text-center text-muted-foreground py-4">搜索中...</div>
            ) : searchKeyword.trim() === "" ? (
              <div className="text-center text-muted-foreground py-4">输入关键词搜索文件夹</div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">未找到匹配的文件夹</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {searchResults.map(result => (
                  <div
                    key={result.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-2xl cursor-pointer text-sm transition-colors border border-white/10",
                      "bg-background/20 hover:bg-background/30",
                      selectedId === result.id && "bg-primary/10 border-primary/20"
                    )}
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <Folder className="h-4 w-4 fill-current opacity-70 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{result.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{result.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // 浏览模式
            folderLoading ? (
              <div className="text-center text-muted-foreground py-4">加载中...</div>
            ) : folderError ? (
              <div className="text-center text-muted-foreground py-4">{folderError}。可输入目标目录密码后解锁浏览，或返回上层重新选择。</div>
            ) : items.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">空文件夹</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-2xl cursor-pointer text-sm transition-colors border border-white/10",
                      "bg-background/20 hover:bg-background/30",
                      selectedId === item.id && "bg-primary/10 border-primary/20"
                    )}
                    onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                    onDoubleClick={() => handleEnter(item)}
                  >
                    <Folder className="h-4 w-4 fill-current opacity-70" />
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.id !== "__ROOT__" && (
                      <GlassIconButton
                        glassVariant="lite"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleEnter(item); }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </GlassIconButton>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
          </div>
        </GlassCard>

        {/* 复制时的新名称输入 */}
        {mode === "copy" && !isBatch && (
          <GlassCard variant="lite" className="p-4">
            <div className="grid gap-2">
              <Label htmlFor="newName" className="text-xs">新名称（可选）</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={entry?.original_name}
                className="h-8 text-sm"
              />
            </div>
          </GlassCard>
        )}

        <GlassCard variant="lite" className="p-4 max-h-48 overflow-y-auto shrink-0">
          <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">未设置密码的条目可留空，源条目与目标目录的密码分别验证</p>
            {sourceEntries.map(source => (
              <div key={source.id} className="grid gap-1">
                <Label htmlFor={`source-password-${source.id}`} className="text-xs">
                  源条目密码{isBatch ? `：${source.original_name}` : ""}
                  {submitted.current.has(source.id) ? "（已提交）" : ""}
                </Label>
                <Input id={`source-password-${source.id}`} type="password" autoComplete="off"
                  value={sourcePasswords[source.id] ?? ""}
                  disabled={loading || submitted.current.has(source.id)}
                  onChange={event => setSourcePasswords(previous => ({ ...previous, [source.id]: event.target.value }))}
                  className="h-8 text-sm" />
              </div>
            ))}
            {targetId && (
              <div className="grid gap-1">
                <Label htmlFor="target-password" className="text-xs">目标目录密码</Label>
                <Input id="target-password" type="password" autoComplete="off"
                  value={targetPasswords[targetId] ?? ""} disabled={loading}
                  onChange={event => setTargetPasswords(previous => ({ ...previous, [targetId]: event.target.value }))}
                  className="h-8 text-sm" />
                <button type="button" className="text-xs text-primary text-left disabled:opacity-50"
                  disabled={loading || folderLoading} onClick={() => void handleUnlockTarget()}>
                  解锁并浏览目标目录
                </button>
              </div>
            )}
          </div>
        </GlassCard>

        {error && (
          <GlassCard variant="lite" className="p-3">
            <div className="text-sm text-red-500">{error}</div>
          </GlassCard>
        )}

        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
          leftButtonGlassVariant="lite"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        />
      </DialogContent>
    </Dialog>
  );
}
