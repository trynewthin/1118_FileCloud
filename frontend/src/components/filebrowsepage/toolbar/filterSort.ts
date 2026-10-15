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

