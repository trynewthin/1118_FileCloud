import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { useFileBrowser } from "@/hooks/useFileBrowser";
import { PageContainer } from "@/components/layout/PageContainer";
import { FileToolbar, FileBreadcrumb } from "@/components/files/FileToolbar";
import { FileGridItem } from "@/components/files/FileGridItem";
import { FileListItem } from "@/components/files/FileListItem";
import { RenameDialog } from "@/components/files/dialogs/RenameDialog";
import { DeleteDialog } from "@/components/files/dialogs/DeleteDialog";
import { MoveCopyDialog } from "@/components/files/dialogs/MoveCopyDialog";
import { RecycleBinDialog } from "@/components/files/dialogs/RecycleBinDialog";
import { UploadDialog } from "@/components/files/dialogs/UploadDialog";
import { CreateFolderDialog } from "@/components/files/dialogs/CreateFolderDialog";
import { SearchDialog } from "@/components/files/dialogs/SearchDialog";
import { EntryTagDialog, BatchTagDialog } from "@/components/tag";
import { downloadEntry } from "@/lib/api/files";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import { DelayedLoader } from "@/components/common/DelayedLoader";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BreadcrumbItem } from "@/components/files/FileToolbar";
import {
  type FilterSortState,
  defaultFilterSortState,
  getFileTypeCategory,
} from "@/components/files/FileToolbar";

export function FileBrowserPage() {
  const navigate = useNavigate();
  // URL 参数控制当前库，便于分享链接
  const [searchParams, setSearchParams] = useSearchParams();
  const libraryIdParam = searchParams.get("libraryId");
  const parentIdParam = searchParams.get("parentId");
  
  const { items: libraries, loading: libsLoading } = useFileLibraries();
  
  // 当前选中的文件库 ID（优先从 URL 读取，其次从 localStorage 读取）
  const [activeLibraryId, setActiveLibraryId] = useState<number | null>(() => {
    if (libraryIdParam) {
      return parseInt(libraryIdParam);
    }
    const cached = localStorage.getItem("file_browser_active_library");
    return cached ? parseInt(cached) : null;
  });

  // 视图模式持久化
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("file_browser_view_mode") as "grid" | "list") || "grid";
  });

  // 重建索引对话框状态
  const [reindexDialogOpen, setReindexDialogOpen] = useState(false);

  // 回收站对话框状态
  const [recycleDialogOpen, setRecycleDialogOpen] = useState(false);

  // 上传对话框状态
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // 新建文件夹对话框状态
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);

  // 搜索对话框状态
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  // 滚动容器引用，用于记忆滚动位置
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 滚动位置缓存 key
  const SCROLL_CACHE_KEY = "file_browser_scroll_positions";

  // 文件操作对话框状态
  const [actionDialog, setActionDialog] = useState<{
    type: "rename" | "delete" | "move" | "copy" | null;
    entry: any;
  }>({ type: null, entry: null });

  // 标签对话框状态
  const [tagDialogEntry, setTagDialogEntry] = useState<any>(null);

  // 批量模式状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 批量操作对话框状态
  const [batchActionDialog, setBatchActionDialog] = useState<{
    type: "move" | "copy" | "delete" | null;
  }>({ type: null });

  // 筛选排序状态（持久化到 localStorage）
  const [filterSortState, setFilterSortState] = useState<FilterSortState>(() => {
    try {
      const cached = localStorage.getItem("file_browser_filter_sort");
      if (cached) {
        return { ...defaultFilterSortState, ...JSON.parse(cached) };
      }
    } catch {
      // 解析失败时使用默认值
    }
    return defaultFilterSortState;
  });

  // 筛选排序状态变化时持久化
  const handleFilterSortChange = (state: FilterSortState) => {
    setFilterSortState(state);
    localStorage.setItem("file_browser_filter_sort", JSON.stringify(state));
  };

  const {
    entries,
    ancestors,
    loading: entriesLoading,
    error: entriesError,
    currentParentId,
    setCurrentParentId,
    reload,
    indexLibrary,
    rename,
    move,
    copy,
    remove, // delete 是关键字
    restore,
    destroy,
    upload,
    createFolder,
    getCachedPassword,
  } = useFileBrowser({ libraryId: activeLibraryId });

  // 错误时显示 toast
  useEffect(() => {
    if (entriesError) {
      toast.error(entriesError);
    }
  }, [entriesError]);

  const breadcrumbItems = useMemo(() => {
    return ancestors.map(a => ({ id: a.id, name: a.name }));
  }, [ancestors]);

  const currentPathLabel = useMemo(() => {
    if (!activeLibraryId) return "";
    if (!currentParentId || breadcrumbItems.length === 0) {
      return "当前文件库根目录";
    }
    return breadcrumbItems.map((b) => b.name).join(" / ");
  }, [activeLibraryId, currentParentId, breadcrumbItems]);

  // 初始化同步：如果 URL 有 parentId，设置给 hook
  useEffect(() => {
    if (parentIdParam && parentIdParam !== currentParentId) {
      setCurrentParentId(parentIdParam);
    }
  }, [parentIdParam]); // 这里不能依赖 currentParentId，否则会死循环，只依赖 URL 变化

  // 当库列表加载完成后，如果没有选中库且有可用库，默认选中第一个
  // 如果缓存的库 ID 不存在于当前库列表中，也重置为第一个
  useEffect(() => {
    if (!libsLoading && libraries.length > 0) {
      const libraryExists = activeLibraryId && libraries.some(l => l.id === activeLibraryId);
      if (!libraryExists) {
        const firstId = libraries[0].id;
        setActiveLibraryId(firstId);
        localStorage.setItem("file_browser_active_library", firstId.toString());
        setSearchParams({ libraryId: firstId.toString() });
      }
    }
  }, [libsLoading, libraries, activeLibraryId, setSearchParams]);

  // 切换库时重置状态
  const handleLibraryChange = (idStr: string) => {
    const id = parseInt(idStr);
    setActiveLibraryId(id);
    localStorage.setItem("file_browser_active_library", idStr);
    setSearchParams({ libraryId: idStr }); // 清除 parentId
    setCurrentParentId(null);
  };

  // 切换视图模式
  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("file_browser_view_mode", mode);
  };

  // 保存当前滚动位置到 sessionStorage
  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current && activeLibraryId) {
      const posKey = `${activeLibraryId}-${currentParentId || 'root'}`;
      try {
        const cached = sessionStorage.getItem(SCROLL_CACHE_KEY);
        const positions: Record<string, number> = cached ? JSON.parse(cached) : {};
        positions[posKey] = scrollContainerRef.current.scrollTop;
        sessionStorage.setItem(SCROLL_CACHE_KEY, JSON.stringify(positions));
      } catch {
        // sessionStorage 不可用时忽略
      }
    }
  }, [activeLibraryId, currentParentId]);

  // 从 sessionStorage 恢复滚动位置
  const restoreScrollPosition = useCallback(() => {
    if (scrollContainerRef.current && activeLibraryId) {
      const posKey = `${activeLibraryId}-${currentParentId || 'root'}`;
      try {
        const cached = sessionStorage.getItem(SCROLL_CACHE_KEY);
        if (cached) {
          const positions: Record<string, number> = JSON.parse(cached);
          const savedPosition = positions[posKey];
          if (savedPosition !== undefined && savedPosition > 0) {
            // 使用 requestAnimationFrame 确保 DOM 已更新
            requestAnimationFrame(() => {
              scrollContainerRef.current?.scrollTo(0, savedPosition);
            });
          }
        }
      } catch {
        // sessionStorage 不可用时忽略
      }
    }
  }, [activeLibraryId, currentParentId]);

  // 当文件列表加载完成后恢复滚动位置
  useEffect(() => {
    if (!entriesLoading && entries.length > 0) {
      restoreScrollPosition();
    }
  }, [entriesLoading, entries.length, restoreScrollPosition]);

  // 进入目录
  const handleEnterDirectory = (entry: { id: string; original_name: string }) => {
    saveScrollPosition();
    setCurrentParentId(entry.id);
    setSearchParams({ 
      libraryId: activeLibraryId!.toString(), 
      parentId: entry.id 
    });
  };

  // 面包屑导航
  const handleBreadcrumbRootClick = () => {
    saveScrollPosition();
    setCurrentParentId(null);
    setSearchParams({ libraryId: activeLibraryId!.toString() });
  };

  // 返回上一级目录
  const handleGoUp = () => {
    if (!currentParentId || breadcrumbItems.length === 0) {
      // 已经在根目录
      return;
    }
    saveScrollPosition();
    if (breadcrumbItems.length === 1) {
      // 只有一级，返回根目录
      setCurrentParentId(null);
      setSearchParams({ libraryId: activeLibraryId!.toString() });
    } else {
      // 返回上一级（倒数第二个）
      const parentItem = breadcrumbItems[breadcrumbItems.length - 2];
      setCurrentParentId(parentItem.id);
      setSearchParams({ 
        libraryId: activeLibraryId!.toString(), 
        parentId: parentItem.id 
      });
    }
  };

  const handleBreadcrumbItemClick = (item: BreadcrumbItem) => {
    // 如果点击的是当前项，不做任何事
    if (item.id === currentParentId) return;
    
    saveScrollPosition();
    setCurrentParentId(item.id);
    setSearchParams({ 
      libraryId: activeLibraryId!.toString(), 
      parentId: item.id 
    });
  };

  // 文件操作（暂未实现具体逻辑）
  const handleFileAction = (action: string, entry: any) => {
    if (action === "download") {
      if (entry.is_directory) return;

      try {
        const pwd = getCachedPassword(entry.id);
        const url = downloadEntry(entry.id, pwd, entry.original_name);

        const link = document.createElement("a");
        link.href = url;
        link.download = entry.original_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("下载失败", err);
      }
      return;
    }

    if (action === "rename" || action === "delete" || action === "move" || action === "copy") {
      setActionDialog({ type: action, entry });
    } else if (action === "tag") {
      setTagDialogEntry(entry);
    } else {
      console.log("Unknown action:", action, entry);
    }
  };

  // 处理重命名提交
  const handleRenameSubmit = async (entry: any, newName: string, password?: string) => {
    await rename(entry.id, newName, password);
  };

  // 处理删除提交
  const handleDeleteSubmit = async (entry: any, password?: string) => {
    await remove(entry.id, password);
  };

  // 处理移动/复制提交
  const handleMoveCopySubmit = async (
    entry: any, 
    targetParentId: string | null, 
    newName?: string, 
    password?: string
  ) => {
    if (actionDialog.type === "move") {
      await move(entry.id, { targetParentId, password });
    } else if (actionDialog.type === "copy") {
      await copy(entry.id, { targetParentId, newName, password });
    }
  };

  // 手动触发重新索引（确认逻辑）
  const handleReindexConfirm = async (forceReindex: boolean) => {
    setReindexDialogOpen(false);
    if (!activeLibraryId) return;

    try {
      await indexLibrary({ forceReindex });
      // 索引任务将在后台执行，用户可在任务中心查看进度
    } catch (err: any) {
      console.error("索引触发失败", err);
    }
  };

  // 当前库对象
  const activeLibrary = useMemo(
    () => libraries.find((l) => l.id === activeLibraryId),
    [libraries, activeLibraryId]
  );

  // 批量选择处理
  const handleBatchSelect = (entry: any, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(entry.id);
      } else {
        next.delete(entry.id);
      }
      return next;
    });
  };

  // 退出批量模式时清空选择
  const handleBatchModeChange = (enabled: boolean) => {
    setBatchMode(enabled);
    if (!enabled) {
      setSelectedIds(new Set());
    }
  };

  // 获取选中的文件列表
  const selectedEntries = useMemo(() => {
    return entries.filter(e => selectedIds.has(e.id));
  }, [entries, selectedIds]);

  // 筛选和排序后的文件列表
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // 筛选文件类型
    if (filterSortState.fileType !== "all") {
      result = result.filter((entry) => {
        const category = getFileTypeCategory(entry.extension, entry.is_directory);
        return category === filterSortState.fileType;
      });
    }

    // 排序
    result.sort((a, b) => {
      // 文件夹始终排在前面（除非筛选了特定类型）
      if (filterSortState.fileType === "all") {
        if (a.is_directory && !b.is_directory) return -1;
        if (!a.is_directory && b.is_directory) return 1;
      }

      let comparison = 0;
      switch (filterSortState.sortField) {
        case "name":
          comparison = a.original_name.localeCompare(b.original_name, "zh-CN");
          break;
        case "size":
          comparison = (a.size_bytes || 0) - (b.size_bytes || 0);
          break;
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "updated_at":
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }

      return filterSortState.sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [entries, filterSortState]);

  // 批量删除处理
  const handleBatchDelete = async () => {
    if (selectedEntries.length === 0) return;
    setBatchActionDialog({ type: "delete" });
  };

  // 批量删除确认
  const handleBatchDeleteConfirm = async () => {
    try {
      for (const entry of selectedEntries) {
        await remove(entry.id);
      }
      toast.success(`已删除 ${selectedEntries.length} 个项目`);
      setBatchActionDialog({ type: null });
      handleBatchModeChange(false);
    } catch (err) {
      console.error("批量删除失败", err);
    }
  };

  // 批量移动处理
  const handleBatchMove = () => {
    if (selectedEntries.length === 0) return;
    setBatchActionDialog({ type: "move" });
  };

  // 批量复制处理
  const handleBatchCopy = () => {
    if (selectedEntries.length === 0) return;
    setBatchActionDialog({ type: "copy" });
  };

  // 批量标签处理（只选择文件，不包括文件夹）
  const [batchTagDialogOpen, setBatchTagDialogOpen] = useState(false);
  const selectedFiles = useMemo(() => selectedEntries.filter(e => !e.is_directory), [selectedEntries]);

  const handleBatchTag = () => {
    if (selectedFiles.length === 0) {
      toast.error("请选择至少一个文件（文件夹不支持打标签）");
      return;
    }
    setBatchTagDialogOpen(true);
  };

  // 全选/全不选
  const handleSelectAll = () => {
    setSelectedIds(new Set(entries.map(e => e.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // 批量移动/复制提交
  const handleBatchMoveCopySubmit = async (targetParentId: string | null) => {
    try {
      for (const entry of selectedEntries) {
        if (batchActionDialog.type === "move") {
          await move(entry.id, { targetParentId });
        } else if (batchActionDialog.type === "copy") {
          await copy(entry.id, { targetParentId });
        }
      }
      toast.success(`已${batchActionDialog.type === "move" ? "移动" : "复制"} ${selectedEntries.length} 个项目`);
      setBatchActionDialog({ type: null });
      handleBatchModeChange(false);
    } catch (err) {
      console.error("批量操作失败", err);
    }
  };

  return (
    <PageContainer title="文件浏览" className="h-full flex flex-col relative">
      <div className="flex-none space-y-2 z-10 relative">
        <FileToolbar
          libraries={libraries}
          currentLibraryId={activeLibraryId}
          onLibraryChange={handleLibraryChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          canGoUp={!!currentParentId}
          onGoUp={handleGoUp}
          filterSortState={activeLibraryId ? filterSortState : undefined}
          onFilterSortChange={activeLibraryId ? handleFilterSortChange : undefined}
          batchMode={batchMode}
          onBatchModeChange={handleBatchModeChange}
          selectedCount={selectedIds.size}
          onBatchMove={handleBatchMove}
          onBatchCopy={handleBatchCopy}
          onBatchDelete={handleBatchDelete}
          onBatchTag={handleBatchTag}
          totalCount={entries.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
        
        <div className="px-1">
          <FileBreadcrumb 
            items={breadcrumbItems}
            onRootClick={handleBreadcrumbRootClick}
            onItemClick={handleBreadcrumbItemClick}
            onSearch={activeLibraryId ? () => setSearchDialogOpen(true) : undefined}
            onUpload={activeLibraryId ? () => setUploadDialogOpen(true) : undefined}
            onCreateFolder={activeLibraryId ? () => setCreateFolderDialogOpen(true) : undefined}
            onRefresh={reload}
            onReindex={activeLibraryId ? () => setReindexDialogOpen(true) : undefined}
            onBatchMode={activeLibraryId ? () => handleBatchModeChange(true) : undefined}
            onOpenTrash={activeLibraryId ? () => setRecycleDialogOpen(true) : undefined}
          />
        </div>
      </div>

      <GlassCard 
        ref={scrollContainerRef}
        variant="ghost" 
        className="flex-1 mt-4 min-h-0 overflow-y-auto px-2 py-2 z-10"
      >
        <DelayedLoader 
          loading={libsLoading || (!!activeLibrary && entriesLoading)} 
          className="flex h-full items-center justify-center"
        >
          {!activeLibrary ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              请选择一个文件库开始浏览
            </div>
          ) : entriesError ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              加载失败
            </div>
          ) : filteredAndSortedEntries.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
              {filterSortState.fileType !== "all" && entries.length > 0 ? (
                <>
                  <p>没有符合筛选条件的文件</p>
                  <p className="text-xs opacity-70">当前筛选条件下无匹配结果，请调整筛选条件</p>
                  <GlassButton 
                    onClick={() => handleFilterSortChange(defaultFilterSortState)}
                    className="text-xs text-primary hover:underline mt-2"
                    glassVariant="ghost"
                  >
                    清除筛选条件
                  </GlassButton>
                </>
              ) : (
                <>
                  <p>此文件夹为空</p>
                  <p className="text-xs opacity-70">如果刚创建文件库，可能正在后台建立索引，请稍后刷新</p>
                  <GlassButton 
                    onClick={() => setReindexDialogOpen(true)}
                    className="text-xs text-primary hover:underline mt-2"
                    glassVariant="ghost"
                  >
                    手动触发索引
                  </GlassButton>
                </>
              )}
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
                  : "space-y-2"
              }
            >
              {filteredAndSortedEntries.map((entry) => {
                const Component = viewMode === "grid" ? FileGridItem : FileListItem;
                return (
                  <Component
                    key={entry.id}
                    entry={entry}
                    onClick={() => {
                      // 批量模式下点击切换选中状态
                      if (batchMode) {
                        handleBatchSelect(entry, !selectedIds.has(entry.id));
                        return;
                      }
                      if (entry.is_directory) {
                        handleEnterDirectory(entry);
                      } else {
                        saveScrollPosition();
                        navigate(`/preview/${entry.id}`);
                      }
                    }}
                    onDoubleClick={() => {
                      // 批量模式下双击不做任何事
                      if (batchMode) return;
                      if (entry.is_directory) {
                        handleEnterDirectory(entry);
                      } else {
                        saveScrollPosition();
                        navigate(`/preview/${entry.id}`);
                      }
                    }}
                    onAction={handleFileAction}
                    batchMode={batchMode}
                    batchSelected={selectedIds.has(entry.id)}
                    onBatchSelect={handleBatchSelect}
                  />
                );
              })}
            </div>
          )}
        </DelayedLoader>
      </GlassCard>

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        targetPathLabel={currentPathLabel}
        onSubmit={async (files, onProgress) => {
          await upload(files, currentParentId, onProgress);
        }}
      />

      {/* 新建文件夹对话框 */}
      <CreateFolderDialog
        open={createFolderDialogOpen}
        onOpenChange={setCreateFolderDialogOpen}
        onSubmit={async (name) => {
          await createFolder(name, currentParentId);
        }}
      />

      {/* 文件操作对话框 */}
      {actionDialog.type === "rename" && (
        <RenameDialog
          entry={actionDialog.entry}
          open={true}
          onOpenChange={(open) => !open && setActionDialog({ type: null, entry: null })}
          onSubmit={handleRenameSubmit}
        />
      )}

      {/* 回收站对话框 */}
      <RecycleBinDialog
        open={recycleDialogOpen}
        onOpenChange={setRecycleDialogOpen}
        libraryId={activeLibraryId}
        onRestore={(id) => restore(id)}
        onDestroy={(id) => destroy(id)}
      />
      {actionDialog.type === "delete" && (
        <DeleteDialog
          entry={actionDialog.entry}
          open={true}
          onOpenChange={(open) => !open && setActionDialog({ type: null, entry: null })}
          onSubmit={handleDeleteSubmit}
        />
      )}
      {(actionDialog.type === "move" || actionDialog.type === "copy") && (
        <MoveCopyDialog
          mode={actionDialog.type}
          entry={actionDialog.entry}
          open={true}
          onOpenChange={(open) => !open && setActionDialog({ type: null, entry: null })}
          onSubmit={handleMoveCopySubmit}
        />
      )}

      <AlertDialog open={reindexDialogOpen} onOpenChange={setReindexDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重建索引</AlertDialogTitle>
            <AlertDialogDescription>
              选择索引模式：增量索引只处理变动的文件，强制索引会清空现有索引并完全重建。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <AlertDialogCancel>取消</AlertDialogCancel>
            <div className="flex gap-2 sm:ml-auto">
              <GlassButton
                glassVariant="lite"
                onClick={() => handleReindexConfirm(false)}
                className="bg-primary/10 text-primary hover:bg-primary/20"
              >
                增量索引
              </GlassButton>
              <GlassButton
                glassVariant="lite"
                onClick={() => handleReindexConfirm(true)}
                className="bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                强制索引
              </GlassButton>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog 
        open={batchActionDialog.type === "delete"} 
        onOpenChange={(open) => !open && setBatchActionDialog({ type: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedEntries.length} 个项目吗？删除后可在回收站中恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <GlassButton
              glassVariant="lite"
              onClick={handleBatchDeleteConfirm}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              删除
            </GlassButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量移动/复制对话框 */}
      {(batchActionDialog.type === "move" || batchActionDialog.type === "copy") && selectedEntries.length > 0 && (
        <MoveCopyDialog
          mode={batchActionDialog.type}
          entry={selectedEntries[0]}
          open={true}
          onOpenChange={(open) => !open && setBatchActionDialog({ type: null })}
          onSubmit={async (_entry, targetParentId) => {
            await handleBatchMoveCopySubmit(targetParentId);
          }}
          batchCount={selectedEntries.length}
        />
      )}

      {/* 搜索对话框 */}
      {activeLibraryId && (
        <SearchDialog
          open={searchDialogOpen}
          onOpenChange={setSearchDialogOpen}
          libraryId={activeLibraryId}
        />
      )}

      {/* 标签对话框 */}
      {tagDialogEntry && (
        <EntryTagDialog
          open={true}
          onOpenChange={(open) => !open && setTagDialogEntry(null)}
          entryId={tagDialogEntry.id}
        />
      )}

      {/* 批量标签对话框 */}
      {batchTagDialogOpen && selectedFiles.length > 0 && (
        <BatchTagDialog
          open={true}
          onOpenChange={setBatchTagDialogOpen}
          entryIds={selectedFiles.map(e => e.id)}
          fileCount={selectedFiles.length}
          onSuccess={() => handleBatchModeChange(false)}
        />
      )}
    </PageContainer>
  );
}
