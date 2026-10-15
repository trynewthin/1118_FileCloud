export type { FilterSortState, FileTypeFilter, SortField, SortOrder } from "./filterSort";
import { defaultFilterSortState } from "./filterSort";
import type { FilterSortState, FileTypeFilter, SortField, SortOrder } from "./filterSort";
import { Filter, ArrowUpDown, Check } from "lucide-react";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

// ============================================================================
// 文件类型标签映射
// ============================================================================
const fileTypeLabels: Record<FileTypeFilter, string> = {
  all: "全部",
  folder: "文件夹",
  image: "图片",
  video: "视频",
  audio: "音频",
  document: "文档",
  archive: "压缩包",
  other: "其他",
};

// ============================================================================
// 排序字段标签映射
// ============================================================================
const sortFieldLabels: Record<SortField, string> = {
  name: "名称",
  size: "大小",
  created_at: "创建时间",
  updated_at: "修改时间",
};

// ============================================================================
// 排序方向标签映射
// ============================================================================
const sortOrderLabels: Record<SortOrder, string> = {
  asc: "正序",
  desc: "倒序",
};

// ============================================================================
// FilterSortMenu 组件
// ============================================================================
interface FilterSortMenuProps {
  state: FilterSortState;
  onChange: (state: FilterSortState) => void;
  className?: string;
}

export function FilterSortMenu({ state, onChange, className }: FilterSortMenuProps) {
  const isActive = state.fileType !== "all" || state.sortField !== "name" || state.sortOrder !== "asc";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <GlassIconButton
          glassVariant="lite"
          className={cn("h-8 w-8", className)}
          title="筛选与排序"
        >
          <Filter className="h-4 w-4" />
        </GlassIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("min-w-[220px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
      >
        {/* 文件类型筛选子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Filter className="h-4 w-4 mr-2" />
            类型筛选
            {state.fileType !== "all" && (
              <span className="ml-auto text-xs text-muted-foreground">
                {fileTypeLabels[state.fileType]}
              </span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              className={cn("min-w-[120px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
            >
              {(Object.keys(fileTypeLabels) as FileTypeFilter[]).map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => onChange({ ...state, fileType: type })}
                >
                  {state.fileType === type && <Check className="h-4 w-4 mr-2" />}
                  <span className={state.fileType !== type ? "ml-6" : ""}>
                    {fileTypeLabels[type]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* 排序字段子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowUpDown className="h-4 w-4 mr-2" />
            排序方式
            <span className="ml-auto text-xs text-muted-foreground">
              {sortFieldLabels[state.sortField]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="min-w-[120px]">
              {(Object.keys(sortFieldLabels) as SortField[]).map((field) => (
                <DropdownMenuItem
                  key={field}
                  onClick={() => onChange({ ...state, sortField: field })}
                >
                  {state.sortField === field && <Check className="h-4 w-4 mr-2" />}
                  <span className={state.sortField !== field ? "ml-6" : ""}>
                    {sortFieldLabels[field]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* 排序方向子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowUpDown className="h-4 w-4 mr-2 opacity-0" />
            排序方向
            <span className="ml-auto text-xs text-muted-foreground">
              {sortOrderLabels[state.sortOrder]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              className={cn("min-w-[100px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
            >
              {(Object.keys(sortOrderLabels) as SortOrder[]).map((order) => (
                <DropdownMenuItem
                  key={order}
                  onClick={() => onChange({ ...state, sortOrder: order })}
                >
                  {state.sortOrder === order && <Check className="h-4 w-4 mr-2" />}
                  <span className={state.sortOrder !== order ? "ml-6" : ""}>
                    {sortOrderLabels[order]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* 重置按钮 */}
        {isActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChange(defaultFilterSortState)}
              className="text-muted-foreground"
            >
              重置筛选排序
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
