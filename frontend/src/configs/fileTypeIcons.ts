// 文件类型与图标分组配置，方便统一维护与后续动态调整
// 所有注释使用中文

import type { LucideIcon } from "lucide-react";
import {
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  FileArchive,
  File as DefaultFileIcon,
} from "lucide-react";

// 按文件扩展名分组，不含点号，小写
export const FILE_ICON_GROUPS: Record<string, string[]> = {
  // 图片类
  image: ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif", "heic", "heif", "avif"],

  // 视频类
  video: ["mp4", "webm", "mov", "avi", "mkv", "m4v", "wmv"],

  // 音频类
  audio: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "opus"],

  // 文档类（目前仅区分 pdf）
  pdf: ["pdf"],

  // 压缩包/归档类
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2"],
};

// 需要生成缩略图的扩展名（用于列表/网格中的缩略图判断）
export const THUMBNAIL_EXTS = new Set<string>([
  // 图片
  "jpg", "jpeg", "png", "webp", "gif",
  // 视频
  "mp4", "webm", "mov", "mkv", "avi",
]);

// 工具函数：根据扩展名返回所属分组 key，未命中时返回 undefined
export type FileIconGroupKey = keyof typeof FILE_ICON_GROUPS;

export function getFileIconGroup(ext: string): FileIconGroupKey | undefined {
  const lower = ext.toLowerCase();
  for (const key of Object.keys(FILE_ICON_GROUPS) as FileIconGroupKey[]) {
    if (FILE_ICON_GROUPS[key].includes(lower)) {
      return key;
    }
  }
  return undefined;
}

// 每种分组对应的图标组件映射
export const FILE_ICON_COMPONENTS: Record<FileIconGroupKey, LucideIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  archive: FileArchive,
};

// 未识别类型时的默认图标组件
export const FILE_ICON_DEFAULT_COMPONENT: LucideIcon = DefaultFileIcon;
