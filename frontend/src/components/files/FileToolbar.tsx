import { 
  X, Move, Copy, Trash, ArrowLeft, Upload, FolderPlus,
  ChevronRight, Home, MoreHorizontal, RefreshCw, RotateCw, CheckSquare, Trash2, Grid, List, Search, Tag, Square, CheckSquare2
} from "lucide-react";
import { FilterSortMenu, type FilterSortState } from "./FilterSortMenu";

// 重新导出筛选排序相关类型，方便外部使用
export type { FilterSortState } from "./FilterSortMenu";
export { defaultFilterSortState, getFileTypeCategory } from "./FilterSortMenu";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import { cn } from "@/lib/utils";

// ============================================================================
// 面包屑项类型
// ============================================================================
export interface BreadcrumbItem {
  id: string;
  name: string;
}

// ============================================================================
// FileToolbar - 文件浏览器顶部工具栏
// 包含：文件库选择、视图切换、上一级按钮、批量操作
// ============================================================================
interface FileToolbarProps {
  libraries: FileLibrary[];
  currentLibraryId: number | null;
  onLibraryChange: (id: string) => void;
  // 视图切换
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
  // 上一级
  canGoUp?: boolean;
  onGoUp?: () => void;
  // 筛选排序
  filterSortState?: FilterSortState;
  onFilterSortChange?: (state: FilterSortState) => void;
  // 批量模式相关
  batchMode?: boolean;
  onBatchModeChange?: (enabled: boolean) => void;
  selectedCount?: number;
  onBatchMove?: () => void;
  onBatchCopy?: () => void;
  onBatchDelete?: () => void;
  onBatchTag?: () => void;
  // 全选/全不选
  totalCount?: number;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

export function FileToolbar({
  libraries,
  currentLibraryId,
  onLibraryChange,
  viewMode,
  onViewModeChange,
  canGoUp = false,
  onGoUp,
  filterSortState,
  onFilterSortChange,
  batchMode = false,
  onBatchModeChange,
  selectedCount = 0,
  onBatchMove,
  onBatchCopy,
  onBatchDelete,
  onBatchTag,
  totalCount = 0,
  onSelectAll,
  onDeselectAll,
}: FileToolbarProps) {
  // 批量模式下显示批量操作栏
  if (batchMode) {
    const allSelected = totalCount > 0 && selectedCount === totalCount;

    return (
      <GlassCard className="px-2 py-1.5 md:px-3 md:py-2 flex items-center justify-between gap-2">
        {/* 左侧：取消 + 全选/全不选 + 已选数量 */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onBatchModeChange?.(false)}
            title="取消"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
          {/* 全选/全不选按钮 */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            title={allSelected ? "全不选" : "全选"}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            {allSelected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            已选 <span className="font-medium text-foreground">{selectedCount}</span> / {totalCount} 项
          </span>
        </div>
        {/* 右侧：批量操作按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={selectedCount === 0}
            onClick={onBatchMove}
            title="移动"
            className="text-muted-foreground hover:text-foreground"
          >
            <Move className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={selectedCount === 0}
            onClick={onBatchCopy}
            title="复制"
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={selectedCount === 0}
            onClick={onBatchTag}
            title="标签"
            className="text-muted-foreground hover:text-foreground"
          >
            <Tag className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={selectedCount === 0}
            onClick={onBatchDelete}
            title="删除"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="px-2 py-1.5 md:px-3 md:py-2 flex items-center justify-between gap-2">
      {/* 左侧：文件库选择 */}
      <Select
        value={currentLibraryId?.toString() ?? ""}
        onValueChange={onLibraryChange}
      >
        <SelectTrigger className="w-[140px] md:w-[180px] h-8 text-xs md:text-sm bg-background/50 border-transparent shadow-sm focus:ring-1">
          <SelectValue placeholder="选择文件库" />
        </SelectTrigger>
        <SelectContent>
          {libraries.map((lib) => (
            <SelectItem key={lib.id} value={lib.id.toString()}>
              {lib.display_name || lib.root_path}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 右侧：上一级 + 筛选排序 + 视图切换 */}
      <div className="flex items-center gap-1">
        {/* 上一级按钮 */}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canGoUp}
          onClick={onGoUp}
          title="上一级"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* 筛选排序按钮 */}
        {filterSortState && onFilterSortChange && (
          <FilterSortMenu
            state={filterSortState}
            onChange={onFilterSortChange}
          />
        )}

        {/* 视图切换 */}
        {onViewModeChange && (
          <div className="flex items-center p-0.5 gap-0.5 rounded-md bg-muted/50">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              className={cn("h-7 w-7 shadow-none", viewMode === "grid" && "bg-background shadow-sm")}
              onClick={() => onViewModeChange("grid")}
              title="网格视图"
            >
              <Grid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              className={cn("h-7 w-7 shadow-none", viewMode === "list" && "bg-background shadow-sm")}
              onClick={() => onViewModeChange("list")}
              title="列表视图"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ============================================================================
// FileBreadcrumb - 面包屑导航栏
// 包含：路径导航、搜索、上传、新建文件夹、更多操作（刷新、重建索引、批量选择、回收站）
// ============================================================================
interface FileBreadcrumbProps {
  items: BreadcrumbItem[];
  onRootClick: () => void;
  onItemClick: (item: BreadcrumbItem, index: number) => void;
  className?: string;
  // 右侧操作
  onSearch?: () => void;
  onUpload?: () => void;
  onCreateFolder?: () => void;
  onRefresh?: () => void;
  onReindex?: () => void;
  onBatchMode?: () => void;
  onOpenTrash?: () => void;
}

export function FileBreadcrumb({
  items,
  onRootClick,
  onItemClick,
  className,
  onSearch,
  onUpload,
  onCreateFolder,
  onRefresh,
  onReindex,
  onBatchMode,
  onOpenTrash,
}: FileBreadcrumbProps) {
  const hasActions = onSearch || onUpload || onCreateFolder || onRefresh || onReindex || onBatchMode || onOpenTrash;

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 当面包屑变化时自动滚动到最右侧，保证当前目录可见
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 使用 requestAnimationFrame 确保布局已完成
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
  }, [items.length]);

  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {/* 左侧固定 Home 图标 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1 hover:bg-transparent hover:text-foreground shrink-0"
        onClick={onRootClick}
      >
        <Home className="h-4 w-4" />
      </Button>

      {/* 中间：可横向滚动的路径部分 */}
      <div
        ref={scrollRef}
        className="flex-1 min-w-0 overflow-x-auto scrollbar-thin pr-1"
      >
        <nav className="flex items-center text-sm text-muted-foreground min-w-fit">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center min-w-0">
              <ChevronRight className="h-4 w-4 mx-0.5 shrink-0 opacity-50" />
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-auto p-1 hover:bg-transparent hover:text-foreground font-normal truncate max-w-[140px] md:max-w-[220px]",
                  index === items.length - 1 && "font-medium text-foreground pointer-events-none"
                )}
                onClick={() => onItemClick(item, index)}
                title={item.name}
              >
                {item.name}
              </Button>
            </div>
          ))}
        </nav>
      </div>

      {/* 右侧：操作按钮 */}
      {hasActions && (
        <div className="flex items-center gap-1 shrink-0">
          {/* 搜索按钮 */}
          {onSearch && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onSearch}
              title="搜索"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          {/* 新建文件夹 */}
          {onCreateFolder && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCreateFolder}
              title="新建文件夹"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          )}

          {/* 上传 */}
          {onUpload && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onUpload}
              title="上传"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
            </Button>
          )}

          {/* 更多操作下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {onRefresh && (
                <DropdownMenuItem onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </DropdownMenuItem>
              )}
              {onReindex && (
                <DropdownMenuItem onClick={onReindex}>
                  <RotateCw className="h-4 w-4 mr-2" />
                  重建索引
                </DropdownMenuItem>
              )}
              {onBatchMode && (
                <DropdownMenuItem onClick={onBatchMode}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  批量选择
                </DropdownMenuItem>
              )}
              {onOpenTrash && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpenTrash} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    回收站
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
