import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { useFileBrowser } from "@/hooks/useFileBrowser";
import { PageContainer } from "@/components/layout/PageContainer";
import { FileToolbar } from "@/components/files/FileToolbar";
import { FileBreadcrumb } from "@/components/files/FileBreadcrumb";
import { FileGridItem } from "@/components/files/FileGridItem";
import { FileListItem } from "@/components/files/FileListItem";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function FileBrowserPage() {
  // URL 参数控制当前库，便于分享链接
  const [searchParams, setSearchParams] = useSearchParams();
  const libraryIdParam = searchParams.get("libraryId");
  const parentIdParam = searchParams.get("parentId");
  
  const { items: libraries, loading: libsLoading } = useFileLibraries();
  
  // 当前选中的文件库 ID
  const [activeLibraryId, setActiveLibraryId] = useState<number | null>(
    libraryIdParam ? parseInt(libraryIdParam) : null
  );

  // 视图模式持久化
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("file_browser_view_mode") as "grid" | "list") || "grid";
  });

  // 重建索引对话框状态
  const [reindexDialogOpen, setReindexDialogOpen] = useState(false);

  const {
    entries,
    ancestors,
    loading: entriesLoading,
    error: entriesError,
    currentParentId,
    setCurrentParentId,
    reload,
    indexLibrary,
  } = useFileBrowser({ libraryId: activeLibraryId });

  const breadcrumbItems = useMemo(() => {
    return ancestors.map(a => ({ id: a.id, name: a.name }));
  }, [ancestors]);

  // 初始化同步：如果 URL 有 parentId，设置给 hook
  useEffect(() => {
    if (parentIdParam && parentIdParam !== currentParentId) {
      setCurrentParentId(parentIdParam);
    }
  }, [parentIdParam]); // 这里不能依赖 currentParentId，否则会死循环，只依赖 URL 变化

  // 当库列表加载完成后，如果没有选中库且有可用库，默认选中第一个
  useEffect(() => {
    if (!libsLoading && libraries.length > 0 && activeLibraryId === null) {
      const firstId = libraries[0].id;
      setActiveLibraryId(firstId);
      setSearchParams({ libraryId: firstId.toString() });
    }
  }, [libsLoading, libraries, activeLibraryId, setSearchParams]);

  // 切换库时重置状态
  const handleLibraryChange = (idStr: string) => {
    const id = parseInt(idStr);
    setActiveLibraryId(id);
    setSearchParams({ libraryId: idStr }); // 清除 parentId
    setCurrentParentId(null);
  };

  // 切换视图模式
  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("file_browser_view_mode", mode);
  };

  // 进入目录
  const handleEnterDirectory = (entry: { id: string; original_name: string }) => {
    setCurrentParentId(entry.id);
    setSearchParams({ 
      libraryId: activeLibraryId!.toString(), 
      parentId: entry.id 
    });
  };

  // 面包屑导航
  const handleBreadcrumbRootClick = () => {
    setCurrentParentId(null);
    setSearchParams({ libraryId: activeLibraryId!.toString() });
  };

  const handleBreadcrumbItemClick = (item: BreadcrumbItem) => {
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
    console.log("Action:", action, entry);
    // TODO: Implement rename, move, copy, delete dialogs
  };

  // 手动触发重新索引（确认逻辑）
  const handleReindexConfirm = async () => {
    setReindexDialogOpen(false);
    if (!activeLibraryId) return;

    try {
      await indexLibrary();
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

  return (
    <PageContainer title="文件浏览" className="h-full flex flex-col">
      <div className="flex-none space-y-4">
        <FileToolbar
          libraries={libraries}
          currentLibraryId={activeLibraryId}
          onLibraryChange={handleLibraryChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onRefresh={reload}
          onReindex={activeLibraryId ? () => setReindexDialogOpen(true) : undefined}
        />
        
        <div className="px-1">
           <FileBreadcrumb 
             items={breadcrumbItems}
             onRootClick={handleBreadcrumbRootClick}
             onItemClick={handleBreadcrumbItemClick}
           />
        </div>
      </div>

      <div className="flex-1 mt-4 min-h-0 overflow-y-auto rounded-lg border bg-muted/5 p-4">
        {libsLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            加载文件库...
          </div>
        ) : !activeLibrary ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            请选择一个文件库开始浏览
          </div>
        ) : entriesLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            加载文件列表...
          </div>
        ) : entriesError ? (
          <div className="flex h-full items-center justify-center text-red-500">
            {entriesError}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
            <p>此文件夹为空</p>
            <p className="text-xs opacity-70">如果刚创建文件库，可能正在后台建立索引，请稍后刷新</p>
            <button 
              onClick={() => setReindexDialogOpen(true)}
              className="text-xs text-primary hover:underline mt-2"
            >
              手动触发索引
            </button>
          </div>
        ) : (
          <div className={
            viewMode === "grid" 
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              : "space-y-2"
          }>
            {entries.map((entry) => {
              const Component = viewMode === "grid" ? FileGridItem : FileListItem;
              return (
                <Component
                  key={entry.id}
                  entry={entry}
                  onClick={() => entry.is_directory && handleEnterDirectory(entry)}
                  onDoubleClick={() => entry.is_directory && handleEnterDirectory(entry)}
                  onAction={handleFileAction}
                />
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={reindexDialogOpen} onOpenChange={setReindexDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重建索引？</AlertDialogTitle>
            <AlertDialogDescription>
              这将对当前文件库执行全量扫描，可能会消耗一定的系统资源。任务将在后台执行，您可以在任务中心查看进度。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReindexConfirm}>确认执行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
