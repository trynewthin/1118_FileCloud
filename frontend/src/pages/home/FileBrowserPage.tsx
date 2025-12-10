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
import { GlobalSearchDialog } from "@/components/files/dialogs/GlobalSearchDialog";
import { EntryTagDialog, BatchTagDialog } from "@/components/tag";
import { downloadEntry, type FileEntry, indexLibrary as indexLibraryApi } from "@/lib/api/files";
import { NewLibraryDialog } from "@/components/file-libraries/NewLibraryDialog";
import { LibraryConfigDialog } from "@/components/file-libraries/LibraryConfigDialog";
import type { FileLibrary } from "@/lib/api/fileLibraries";
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
  
  // 当前选中的文件库 ID（从 URL 读取，不再使用 localStorage 缓存）
  // null 表示在根目录（文件库列表）
  const [activeLibraryId, setActiveLibraryId] = useState<number | null>(() => {
    if (libraryIdParam) {
      return parseInt(libraryIdParam);
    }
    return null; // 默认显示文件库列表
  });

  // 同步 URL 中的 libraryId 到状态（处理跨库跳转场景）
  useEffect(() => {
    const newLibraryId = libraryIdParam ? parseInt(libraryIdParam) : null;
    if (newLibraryId !== activeLibraryId) {
      setActiveLibraryId(newLibraryId);
    }
  }, [libraryIdParam]); // 仅依赖 URL 参数变化

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

  // 全局搜索对话框状态
  const [globalSearchDialogOpen, setGlobalSearchDialogOpen] = useState(false);

  // 新建文件库对话框状态
  const [newLibraryDialogOpen, setNewLibraryDialogOpen] = useState(false);

  // 文件库配置对话框状态
  const [libraryConfigDialog, setLibraryConfigDialog] = useState<{
    open: boolean;
    library: FileLibrary | null;
  }>({ open: false, library: null });

  // 滚动容器引用，用于记忆滚动位置
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 滚动位置缓存 key
  const SCROLL_CACHE_KEY = "file_browser_scroll_positions";
  // 最近一次访问的库与目录缓存 key（用于跨页面返回保持层级）
  const LAST_PATH_CACHE_KEY = "file_browser_last_path";
  // 避免重复恢复上次路径
  const hasRestoredLastPath = useRef(false);

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

  // 当前库对象
  const activeLibrary = useMemo(
    () => libraries.find((l) => l.id === activeLibraryId),
    [libraries, activeLibraryId]
  );

  // 面包屑项：文件库名 + 祖先目录
  const breadcrumbItems = useMemo(() => {
    const items: BreadcrumbItem[] = [];
    
    // 如果在文件库内，添加文件库名作为第一项
    if (activeLibrary) {
      items.push({
        id: `library-${activeLibrary.id}`, // 特殊 ID 标记文件库
        name: activeLibrary.display_name || activeLibrary.root_path,
      });
    }
    
    // 添加祖先目录
    items.push(...ancestors.map(a => ({ id: a.id, name: a.name })));
    
    return items;
  }, [activeLibrary, ancestors]);

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

  // 当库列表加载完成后，如果 URL 中的 libraryId 不存在于库列表中，重置为根目录
  useEffect(() => {
    if (!libsLoading && activeLibraryId) {
      const libraryExists = libraries.some(l => l.id === activeLibraryId);
      if (!libraryExists) {
        // 文件库不存在，返回根目录
        setActiveLibraryId(null);
        setSearchParams({});
        setCurrentParentId(null);
      }
    }
  }, [libsLoading, libraries, activeLibraryId, setSearchParams]);

  // 当 URL 未包含库与目录参数时，从缓存恢复上次访问的层级（组件首次渲染即触发）
  useEffect(() => {
    if (hasRestoredLastPath.current) return;
    // 仅在 URL 无参数时尝试恢复，避免覆盖显式传入的链接
    if (libraryIdParam || parentIdParam) return;

    try {
      const cached = localStorage.getItem(LAST_PATH_CACHE_KEY);
      if (!cached) return;

      const { libraryId: cachedLibraryId, parentId: cachedParentId } = JSON.parse(cached) as {
        libraryId: number | null;
        parentId: string | null;
      };

      if (cachedLibraryId) {
        setActiveLibraryId(cachedLibraryId);
        setCurrentParentId(cachedParentId || null);
        // 同步到 URL，便于刷新或分享
        if (cachedParentId) {
          setSearchParams({ libraryId: cachedLibraryId.toString(), parentId: cachedParentId });
        } else {
          setSearchParams({ libraryId: cachedLibraryId.toString() });
        }
        hasRestoredLastPath.current = true;
      }
    } catch {
      // 解析失败则忽略
    }
  }, [libraryIdParam, parentIdParam, setSearchParams]);

  // 进入文件库（从根目录点击文件库）
  const handleEnterLibrary = (libraryId: number) => {
    setActiveLibraryId(libraryId);
    setSearchParams({ libraryId: libraryId.toString() });
    setCurrentParentId(null);
  };

  // 返回根目录（文件库列表）
  const handleBackToRoot = () => {
    setActiveLibraryId(null);
    setSearchParams({});
    setCurrentParentId(null);
  };

  // 文件库操作处理
  const handleLibraryAction = (action: "config" | "delete" | "reindex", libraryId: number) => {
    const library = libraries.find(l => l.id === libraryId);
    if (!library) return;

    if (action === "config") {
      setLibraryConfigDialog({ open: true, library });
    } else if (action === "reindex") {
      // 直接触发重建索引
      indexLibraryApi(libraryId, { forceReindex: true })
        .then(() => toast.success("索引任务已创建，请在任务中心查看进度"))
        .catch((err: any) => toast.error(err?.message || "创建索引任务失败"));
    } else if (action === "delete") {
      // 打开配置对话框，在里面删除
      setLibraryConfigDialog({ open: true, library });
    }
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

  // 记录最近访问的库与目录，便于跨页面返回时恢复
  useEffect(() => {
    if (libsLoading) return;
    try {
      const payload = {
        libraryId: activeLibraryId,
        parentId: currentParentId,
      };
      localStorage.setItem(LAST_PATH_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage 不可用时忽略
    }
  }, [libsLoading, activeLibraryId, currentParentId]);

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

  // 面包屑导航 - 点击根目录图标
  const handleBreadcrumbRootClick = () => {
    saveScrollPosition();
    // 返回到文件库列表（真正的根目录）
    handleBackToRoot();
  };

  // 返回上一级目录
  const handleGoUp = () => {
    saveScrollPosition();
    
    // 如果在文件库内部
    if (activeLibraryId) {
      if (!currentParentId || breadcrumbItems.length === 0) {
        // 在文件库根目录，返回到文件库列表
        handleBackToRoot();
      } else if (breadcrumbItems.length === 1) {
        // 只有一级，返回文件库根目录
        setCurrentParentId(null);
        setSearchParams({ libraryId: activeLibraryId.toString() });
      } else {
        // 返回上一级（倒数第二个）
        const parentItem = breadcrumbItems[breadcrumbItems.length - 2];
        setCurrentParentId(parentItem.id);
        setSearchParams({ 
          libraryId: activeLibraryId.toString(), 
          parentId: parentItem.id 
        });
      }
    }
    // 如果已经在根目录（文件库列表），不做任何事
  };

  const handleBreadcrumbItemClick = (item: BreadcrumbItem) => {
    saveScrollPosition();
    
    // 如果点击的是文件库项（以 library- 开头），返回文件库根目录
    if (item.id.startsWith("library-")) {
      setCurrentParentId(null);
      setSearchParams({ libraryId: activeLibraryId!.toString() });
      return;
    }
    
    // 如果点击的是当前项，不做任何事
    if (item.id === currentParentId) return;
    
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
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          canGoUp={!!activeLibraryId} // 只要在文件库内就可以返回上一级
          onGoUp={handleGoUp}
          onGlobalSearch={() => setGlobalSearchDialogOpen(true)}
          filterSortState={activeLibraryId ? filterSortState : undefined}
          onFilterSortChange={activeLibraryId ? handleFilterSortChange : undefined}
          batchMode={batchMode}
          onBatchModeChange={handleBatchModeChange}
          selectedCount={selectedIds.size}
          onBatchMove={handleBatchMove}
          onBatchCopy={handleBatchCopy}
          onBatchDelete={handleBatchDelete}
          onBatchTag={handleBatchTag}
          totalCount={activeLibraryId ? entries.length : libraries.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
        
        <div className="px-1">
          <FileBreadcrumb 
            items={breadcrumbItems}
            onRootClick={handleBreadcrumbRootClick}
            onItemClick={handleBreadcrumbItemClick}
            onUpload={activeLibraryId ? () => setUploadDialogOpen(true) : undefined}
            onCreateFolder={activeLibraryId ? () => setCreateFolderDialogOpen(true) : undefined}
            onCreateLibrary={!activeLibraryId ? () => setNewLibraryDialogOpen(true) : undefined}
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
          {/* 根目录：显示文件库列表 */}
          {!activeLibraryId ? (
            libraries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-4">
                <p>暂无文件库</p>
                <NewLibraryDialog onSuccess={reload} />
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
                    : "space-y-2"
                }
              >
                {libraries.map((lib) => {
                  // 将文件库转换为虚拟 FileEntry
                  const virtualEntry: FileEntry = {
                    id: `library-${lib.id}`,
                    library_id: lib.id,
                    parent_id: null,
                    is_directory: true,
                    original_name: lib.display_name || lib.root_path,
                    index_suffix: null,
                    extension: null,
                    size_bytes: 0,
                    mime_type: null,
                    is_deleted: false,
                    deleted_at: null,
                    created_at: lib.created_at,
                    updated_at: lib.updated_at,
                    _isLibraryEntry: true,
                  };
                  const Component = viewMode === "grid" ? FileGridItem : FileListItem;
                  return (
                    <Component
                      key={lib.id}
                      entry={virtualEntry}
                      onClick={() => handleEnterLibrary(lib.id)}
                      onDoubleClick={() => handleEnterLibrary(lib.id)}
                      onLibraryAction={handleLibraryAction}
                    />
                  );
                })}
              </div>
            )
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

      {/* 全局搜索对话框 */}
      <GlobalSearchDialog
        open={globalSearchDialogOpen}
        onOpenChange={setGlobalSearchDialogOpen}
        initialLibraryIds={activeLibraryId ? [activeLibraryId] : undefined}
      />

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

      {/* 文件库配置对话框 */}
      {libraryConfigDialog.library && (
        <LibraryConfigDialog
          library={libraryConfigDialog.library}
          open={libraryConfigDialog.open}
          onOpenChange={(open) => setLibraryConfigDialog({ open, library: open ? libraryConfigDialog.library : null })}
          onUpdated={reload}
          onDeleted={reload}
        />
      )}

      {/* 新建文件库对话框（受控模式） */}
      <NewLibraryDialog
        open={newLibraryDialogOpen}
        onOpenChange={setNewLibraryDialogOpen}
        onSuccess={reload}
        showTrigger={false}
      />
    </PageContainer>
  );
}
