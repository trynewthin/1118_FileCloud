import { Filter, ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
// 文件类型筛选枚举
// ============================================================================
export type FileTypeFilter = 
  | "all"       // 全部
  | "folder"    // 文件夹
  | "image"     // 图片
  | "video"     // 视频
  | "audio"     // 音频
  | "document"  // 文档
  | "archive"   // 压缩包
  | "other";    // 其他

// ============================================================================
// 排序字段枚举
// ============================================================================
export type SortField = 
  | "name"       // 名称
  | "size"       // 大小
  | "created_at" // 创建时间
  | "updated_at"; // 修改时间

// ============================================================================
// 排序方向
// ============================================================================
export type SortOrder = "asc" | "desc";

// ============================================================================
// 筛选排序状态
// ============================================================================
export interface FilterSortState {
  fileType: FileTypeFilter;
  sortField: SortField;
  sortOrder: SortOrder;
}

// ============================================================================
// 默认状态
// ============================================================================
export const defaultFilterSortState: FilterSortState = {
  fileType: "all",
  sortField: "name",
  sortOrder: "asc",
};

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
// 文件扩展名分类
// ============================================================================
const extensionCategories: Record<Exclude<FileTypeFilter, "all" | "folder" | "other">, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "heic", "heif", "tiff", "raw", "cr2", "nef", "arw"],
  video: ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpeg", "mpg", "3gp", "ts"],
  audio: ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a", "opus", "aiff", "ape"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "rtf", "odt", "ods", "odp", "csv", "json", "xml", "html", "htm"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "dmg"],
};

// ============================================================================
// 判断文件扩展名属于哪个类别
// ============================================================================
export function getFileTypeCategory(extension: string | null | undefined, isDirectory: boolean): FileTypeFilter {
  if (isDirectory) return "folder";
  if (!extension) return "other";
  
  const ext = extension.toLowerCase().replace(/^\./, "");
  
  for (const [category, extensions] of Object.entries(extensionCategories)) {
    if (extensions.includes(ext)) {
      return category as FileTypeFilter;
    }
  }
  
  return "other";
}

// ============================================================================
// FilterSortMenu 组件
// ============================================================================
interface FilterSortMenuProps {
  state: FilterSortState;
  onChange: (state: FilterSortState) => void;
  className?: string;
}

export function FilterSortMenu({ state, onChange, className }: FilterSortMenuProps) {
  // 判断是否有激活的筛选/排序（非默认状态）
  const isActive = state.fileType !== "all" || state.sortField !== "name" || state.sortOrder !== "asc";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "h-7 w-7 text-muted-foreground hover:text-foreground",
            isActive && "text-primary",
            className
          )}
          title="筛选与排序"
        >
          <Filter className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("min-w-[160px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
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
