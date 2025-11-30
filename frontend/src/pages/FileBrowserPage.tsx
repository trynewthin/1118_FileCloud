import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { useFileBrowser } from "@/hooks/useFileBrowser";
import { PageContainer } from "@/components/layout/PageContainer";
import { FileToolbar } from "@/components/files/FileToolbar";
import { FileBreadcrumb } from "@/components/files/FileBreadcrumb";
import { FileGridItem } from "@/components/files/FileGridItem";
import { FileListItem } from "@/components/files/FileListItem";
import { RenameDialog } from "@/components/files/dialogs/RenameDialog";
import { DeleteDialog } from "@/components/files/dialogs/DeleteDialog";
import { MoveCopyDialog } from "@/components/files/dialogs/MoveCopyDialog";
import { RecycleBinDialog } from "@/components/files/dialogs/RecycleBinDialog";
import { UploadDialog } from "@/components/files/dialogs/UploadDialog";
import { downloadEntry } from "@/lib/api/files";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check } from "lucide-react";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function FileBrowserPage() {
  const navigate = useNavigate();
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

  // 回收站对话框状态
  const [recycleDialogOpen, setRecycleDialogOpen] = useState(false);

  // 上传对话框状态
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // 文件操作对话框状态
  const [actionDialog, setActionDialog] = useState<{
    type: "rename" | "delete" | "move" | "copy" | null;
    entry: any;
  }>({ type: null, entry: null });

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
    getCachedPassword,
  } = useFileBrowser({ libraryId: activeLibraryId });

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
    <PageContainer title="文件浏览" className="h-full flex flex-col relative">
      <div className="flex-none space-y-4 z-10 relative">
        <FileToolbar
          libraries={libraries}
          currentLibraryId={activeLibraryId}
          onLibraryChange={handleLibraryChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onRefresh={reload}
          onReindex={activeLibraryId ? () => setReindexDialogOpen(true) : undefined}
          onOpenTrash={activeLibraryId ? () => setRecycleDialogOpen(true) : undefined}
          onUpload={activeLibraryId ? () => setUploadDialogOpen(true) : undefined}
        />
        
        <div className="px-1">
           <FileBreadcrumb 
             items={breadcrumbItems}
             onRootClick={handleBreadcrumbRootClick}
             onItemClick={handleBreadcrumbItemClick}
           />
        </div>
      </div>

      <GlassCard variant="ghost" className="flex-1 mt-4 min-h-0 overflow-y-auto px-2 py-2 z-10">
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
            <GlassButton 
              onClick={() => setReindexDialogOpen(true)}
              className="text-xs text-primary hover:underline mt-2"
              glassVariant="ghost"
            >
              手动触发索引
            </GlassButton>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                : "space-y-2"
            }
          >
            {entries.map((entry) => {
              const Component = viewMode === "grid" ? FileGridItem : FileListItem;
              return (
                <Component
                  key={entry.id}
                  entry={entry}
                  onClick={() => {
                    if (entry.is_directory) {
                      handleEnterDirectory(entry);
                    } else {
                      navigate(`/preview/${entry.id}`);
                    }
                  }}
                  onDoubleClick={() => {
                    if (entry.is_directory) {
                      handleEnterDirectory(entry);
                    } else {
                      navigate(`/preview/${entry.id}`);
                    }
                  }}
                  onAction={handleFileAction}
                />
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* 上传对话框 */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        targetPathLabel={currentPathLabel}
        onSubmit={async (files) => {
          await upload(files, currentParentId);
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
            <AlertDialogTitle>确认重建索引？</AlertDialogTitle>
            <AlertDialogDescription>
              这将对当前文件库执行全量扫描，可能会消耗一定的系统资源。任务将在后台执行，您可以在任务中心查看进度。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <GlassButton
              size="icon"
              glassVariant="lite"
              onClick={handleReindexConfirm}
              className="bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">确认执行</span>
            </GlassButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
