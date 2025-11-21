import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { useFileBrowser } from "@/hooks/useFileBrowser";
import { PageContainer } from "@/components/layout/PageContainer";
import { FileToolbar } from "@/components/files/FileToolbar";
import { FileBreadcrumb } from "@/components/files/FileBreadcrumb";
import { FileGridItem } from "@/components/files/FileGridItem";
import { FileListItem } from "@/components/files/FileListItem";

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function FileBrowserPage() {
  // URL 参数控制当前库，便于分享链接
  const [searchParams, setSearchParams] = useSearchParams();
  const libraryIdParam = searchParams.get("libraryId");
  
  const { items: libraries, loading: libsLoading } = useFileLibraries();
  
  // 当前选中的文件库 ID
  const [activeLibraryId, setActiveLibraryId] = useState<number | null>(
    libraryIdParam ? parseInt(libraryIdParam) : null
  );

  // 视图模式持久化
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("file_browser_view_mode") as "grid" | "list") || "grid";
  });

  // 面包屑栈
  const [breadcrumbStack, setBreadcrumbStack] = useState<BreadcrumbItem[]>([]);

  const {
    entries,
    loading: entriesLoading,
    error: entriesError,
    setCurrentParentId,
    reload,
  } = useFileBrowser({ libraryId: activeLibraryId });

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
    setSearchParams({ libraryId: idStr });
    setCurrentParentId(null);
    setBreadcrumbStack([]);
  };

  // 切换视图模式
  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("file_browser_view_mode", mode);
  };

  // 进入目录
  const handleEnterDirectory = (entry: { id: string; original_name: string }) => {
    setBreadcrumbStack((prev) => [...prev, { id: entry.id, name: entry.original_name }]);
    setCurrentParentId(entry.id);
  };

  // 面包屑导航
  const handleBreadcrumbRootClick = () => {
    setCurrentParentId(null);
    setBreadcrumbStack([]);
  };

  const handleBreadcrumbItemClick = (item: BreadcrumbItem, index: number) => {
    // 如果点击的是当前项，不做任何事
    if (index === breadcrumbStack.length - 1) return;
    
    const newStack = breadcrumbStack.slice(0, index + 1);
    setBreadcrumbStack(newStack);
    setCurrentParentId(item.id);
  };

  // 文件操作（暂未实现具体逻辑）
  const handleFileAction = (action: string, entry: any) => {
    console.log("Action:", action, entry);
    // TODO: Implement rename, move, copy, delete dialogs
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
        />
        
        <div className="px-1">
           <FileBreadcrumb 
             items={breadcrumbStack}
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
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <p>此文件夹为空</p>
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
                  onDoubleClick={() => entry.is_directory && handleEnterDirectory(entry)}
                  onAction={handleFileAction}
                />
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
