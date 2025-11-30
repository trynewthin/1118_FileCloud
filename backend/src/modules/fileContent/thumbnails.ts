import fs from "node:fs";
import path from "node:path";
import { db } from "../../core/db/index.ts";
import { getEntryById } from "../files/service.ts";
import { checkEntryPasswordIfProtected } from "../files/security.ts";

interface LibraryRow {
  id: number;
  root_path: string;
  is_enabled: number;
}

const INTERNAL_META_DIR = ".filecloud_meta";
const THUMBNAILS_DIR_NAME = "thumbnails";

// 缩略图文件后缀（按文件类型区分）
const THUMBNAIL_EXT_VIDEO = ".vedtb";  // 视频缩略图
const THUMBNAIL_EXT_IMAGE = ".photb";  // 图片缩略图
const THUMBNAIL_EXT_AUDIO = ".audtb";  // 音频封面
const THUMBNAIL_EXT_PDF = ".pdftb";    // PDF 预览图

// 支持生成缩略图的扩展名
const VIDEO_EXTS = new Set([
  "mp4", "webm", "ogv", "mov", "mkv", "avi", "wmv", "flv", "m4v", "ts", "mts", "m2ts",
]);

const AUDIO_EXTS = new Set([
  "mp3", "flac", "m4a", "aac", "ogg", "opus", "wma", "wav", "ape", "alac", "aiff", "dsf", "dff",
]);

const PDF_EXTS = new Set(["pdf"]);

// 根据文件扩展名获取对应的缩略图后缀
const getThumbnailExt = (ext: string | null): string => {
  if (!ext) return THUMBNAIL_EXT_IMAGE;
  const lower = ext.toLowerCase();
  if (VIDEO_EXTS.has(lower)) return THUMBNAIL_EXT_VIDEO;
  if (AUDIO_EXTS.has(lower)) return THUMBNAIL_EXT_AUDIO;
  if (PDF_EXTS.has(lower)) return THUMBNAIL_EXT_PDF;
  return THUMBNAIL_EXT_IMAGE;
};

// 查询文件库根路径
const getLibraryRoot = (libraryId: number): string => {
  const row = db
    .prepare(
      "SELECT id, root_path, is_enabled FROM file_libraries WHERE id = ? LIMIT 1",
    )
    .get(libraryId) as LibraryRow | undefined;

  if (!row) {
    throw new Error("文件库不存在");
  }

  if (!row.is_enabled) {
    throw new Error("文件库未启用");
  }

  return row.root_path;
};

// 获取指定条目对应的缩略图路径（若不存在或文件不适合缩略图，则返回 null）
export const getThumbnailPathForEntry = (
  entryId: string,
  password?: string,
): { thumbnailPath: string } | null => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件不存在或已删除");
  }

  if (entry.is_directory) {
    throw new Error("目录不支持缩略图");
  }

  const pwdCheck = checkEntryPasswordIfProtected(entryId, password);
  if (!pwdCheck.ok) {
    throw new Error(pwdCheck.message ?? "访问密码错误");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const thumbExt = getThumbnailExt(entry.extension);
  const thumbnailPath = path.join(
    rootPath,
    INTERNAL_META_DIR,
    THUMBNAILS_DIR_NAME,
    `${entryId}${thumbExt}`,
  );

  if (!fs.existsSync(thumbnailPath)) {
    return null;
  }

  return { thumbnailPath };
};
