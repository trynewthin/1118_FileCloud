import type { ReactNode } from "react";
import {
  Search,
  ArrowLeft,
  Grid,
  List,
  FolderPlus,
  Plus,
  Upload,
  MoreHorizontal,
  RefreshCw,
  RotateCw,
  CheckSquare,
  Trash2,
  X,
  Move,
  Copy,
  Trash,
  Tag,
  Square,
  CheckSquare2,
  Star,
} from "lucide-react";
import { GlassButtonGroup } from "@/components/common/GlassButtonGroup";
import { GlassIconButton } from "@/components/common/GlassButton";
import { GlassSegmentedSwitch } from "@/components/common";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterSortMenu, type FilterSortState } from "./toolbar";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

interface FileBrowserHeaderCommonProps {
  // 模式
  batchMode: boolean;

  // 选择状态
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;

  // 返回与导航
  canGoUp: boolean;
  onGoUp: () => void;

  // 搜索/筛选
  onGlobalSearch: () => void;
  filterSortState?: FilterSortState;
  onFilterSortChange?: (state: FilterSortState) => void;

  // 视图
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;

  // 标签浏览
  isVirtualTags: boolean;
  tagBrowseOnlyPrimary: boolean;
  onToggleTagBrowseOnlyPrimary: () => void;

  // 右侧常用操作
  onUpload?: () => void;
  onCreateFolder?: () => void;
  onCreateLibrary?: () => void;

  // 溢出菜单操作
  onRefresh?: () => void;
  onReindex?: () => void;
  onEnterBatchMode?: () => void;
  onOpenTrash?: () => void;

  // 批量操作
  onCancelBatchMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchMove: () => void;
  onBatchCopy: () => void;
  onBatchTag: () => void;
  onBatchDelete: () => void;
}

export function FileBrowserLeftHeaderActions({
  batchMode,
  selectedCount,
  totalCount,
  allSelected,
  canGoUp,
  onGoUp,
  onGlobalSearch,
  filterSortState,
  onFilterSortChange,
  onCancelBatchMode,
  onSelectAll,
  onDeselectAll,
}: Pick<
  FileBrowserHeaderCommonProps,
  | "batchMode"
  | "selectedCount"
  | "totalCount"
  | "allSelected"
  | "canGoUp"
  | "onGoUp"
  | "onGlobalSearch"
  | "filterSortState"
  | "onFilterSortChange"
  | "onCancelBatchMode"
  | "onSelectAll"
  | "onDeselectAll"
>) {
  return batchMode ? (
    <div className="flex items-center gap-2">
      <GlassButtonGroup glassVariant="lite" className="py-0">
        <GlassIconButton glassVariant="lite" onClick={onCancelBatchMode} title="取消">
          <X className="h-4 w-4" />
        </GlassIconButton>
        <GlassIconButton
          glassVariant="lite"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          title={allSelected ? "全不选" : "全选"}
        >
          {allSelected ? <CheckSquare2 className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </GlassIconButton>
      </GlassButtonGroup>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        已选 <span className="font-medium text-foreground">{selectedCount}</span> / {totalCount} 项
      </span>
    </div>
  ) : (
    <GlassButtonGroup glassVariant="lite" className="py-0" wrapNonIconChildren={false}>
      <GlassIconButton glassVariant="lite" onClick={onGlobalSearch} title="搜索">
        <Search className="h-4 w-4" />
      </GlassIconButton>

      {filterSortState && onFilterSortChange && (
        <FilterSortMenu
          state={filterSortState}
          onChange={onFilterSortChange}
          className="h-7! w-7!"
        />
      )}

      <GlassIconButton glassVariant="ghost" disabled={!canGoUp} onClick={onGoUp} title="上一级">
        <ArrowLeft className="h-4 w-4" />
      </GlassIconButton>
    </GlassButtonGroup>
  );
}

export function FileBrowserRightHeaderActions({
  batchMode,
  selectedCount,
  viewMode,
  onViewModeChange,
  isVirtualTags,
  tagBrowseOnlyPrimary,
  onToggleTagBrowseOnlyPrimary,
  onCreateFolder,
  onCreateLibrary,
  onUpload,
  onRefresh,
  onReindex,
  onEnterBatchMode,
  onOpenTrash,
  onBatchMove,
  onBatchCopy,
  onBatchTag,
  onBatchDelete,
}: Pick<
  FileBrowserHeaderCommonProps,
  | "batchMode"
  | "selectedCount"
  | "viewMode"
  | "onViewModeChange"
  | "isVirtualTags"
  | "tagBrowseOnlyPrimary"
  | "onToggleTagBrowseOnlyPrimary"
  | "onCreateFolder"
  | "onCreateLibrary"
  | "onUpload"
  | "onRefresh"
  | "onReindex"
  | "onEnterBatchMode"
  | "onOpenTrash"
  | "onBatchMove"
  | "onBatchCopy"
  | "onBatchTag"
  | "onBatchDelete"
>) {
  if (batchMode) {
    return (
      <GlassButtonGroup glassVariant="lite" className="py-0">
        <GlassIconButton glassVariant="lite" disabled={selectedCount === 0} onClick={onBatchMove} title="移动">
          <Move className="h-4 w-4" />
        </GlassIconButton>
        <GlassIconButton glassVariant="lite" disabled={selectedCount === 0} onClick={onBatchCopy} title="复制">
          <Copy className="h-4 w-4" />
        </GlassIconButton>
        <GlassIconButton glassVariant="lite" disabled={selectedCount === 0} onClick={onBatchTag} title="标签">
          <Tag className="h-4 w-4" />
        </GlassIconButton>
        <GlassIconButton
          glassVariant="lite"
          disabled={selectedCount === 0}
          onClick={onBatchDelete}
          title="删除"
          className="text-destructive"
        >
          <Trash className="h-4 w-4" />
        </GlassIconButton>
      </GlassButtonGroup>
    );
  }

  const hasMenuItems = !!onRefresh || !!onReindex || !!onEnterBatchMode || !!onOpenTrash;

  return (
    <div className="flex items-center gap-2">
      <GlassSegmentedSwitch
        glassVariant="lite"
        size="sm"
        value={viewMode}
        onValueChange={onViewModeChange}
        options={[
          { value: "grid", label: "网格视图", icon: <Grid className="h-3.5 w-3.5" /> },
          { value: "list", label: "列表视图", icon: <List className="h-3.5 w-3.5" /> },
        ]}
      />

      <GlassButtonGroup glassVariant="lite" className="py-0" wrapNonIconChildren={false}>
        {isVirtualTags && (
          <GlassIconButton
            glassVariant="lite"
            onClick={onToggleTagBrowseOnlyPrimary}
            title={tagBrowseOnlyPrimary ? "主标签视图" : "全部标签视图"}
          >
            <Star className={tagBrowseOnlyPrimary ? "h-4 w-4 text-yellow-500 fill-yellow-500" : "h-4 w-4"} />
          </GlassIconButton>
        )}

        {onCreateFolder && (
          <GlassIconButton glassVariant="lite" onClick={onCreateFolder} title="新建文件夹">
            <FolderPlus className="h-4 w-4" />
          </GlassIconButton>
        )}

        {onCreateLibrary && (
          <GlassIconButton glassVariant="lite" onClick={onCreateLibrary} title="新建文件库">
            <Plus className="h-4 w-4" />
          </GlassIconButton>
        )}

        {onUpload && (
          <GlassIconButton glassVariant="lite" onClick={onUpload} title="上传">
            <Upload className="h-4 w-4" />
          </GlassIconButton>
        )}

        {hasMenuItems && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassIconButton glassVariant="lite" title="更多操作" className="h-7! w-7!">
                <MoreHorizontal className="h-4 w-4" />
              </GlassIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn("min-w-[140px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
            >
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
              {onEnterBatchMode && (
                <DropdownMenuItem onClick={onEnterBatchMode}>
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
        )}
      </GlassButtonGroup>
    </div>
  );
}

export function FileBrowserHeaderActionsPlaceholder({ children }: { children?: ReactNode }) {
  return children ?? null;
}
