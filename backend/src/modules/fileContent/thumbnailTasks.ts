/**
 * 缩略图生成任务处理器
 */
import fs from "node:fs/promises";
import { pathExists } from "../../core/fs.ts";
import path from "node:path";
import { spawn } from "node:child_process";
import { db } from "../../core/db/index.ts";
import { assertValidPathSegment, resolveMutationPathWithinLibrary } from "../../core/config/pathSecurity.ts";
import { getEntryById, resolveRealPathForEntry } from "../files/index.ts";
import type { TaskContext } from "../../core/tasks/types.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";

// 缩略图相关任务类型常量（保留用于独立任务，但索引任务会直接调用生成函数）
export const TASK_TYPE_FILE_GENERATE_THUMBNAIL = "FILE_GENERATE_THUMBNAIL";

// 配置常量
const INTERNAL_META_DIR = ".filecloud_meta";
const THUMBNAILS_DIR_NAME = "thumbnails";

// 缩略图文件后缀（按文件类型区分）
export const THUMBNAIL_EXT_VIDEO = ".vedtb";  // 视频缩略图
export const THUMBNAIL_EXT_IMAGE = ".photb";  // 图片缩略图
// 预留其他类型
export const THUMBNAIL_EXT_PDF = ".pdftb";    // PDF 预览图（未来扩展）
export const THUMBNAIL_EXT_AUDIO = ".audtb";  // 音频封面（未来扩展）

// 支持生成缩略图的扩展名（不带点，小写）
const IMAGE_EXTS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "ico", "heic", "heif", "avif",
]);

const VIDEO_EXTS = new Set([
  "mp4", "webm", "ogv", "mov", "mkv", "avi", "wmv", "flv", "m4v", "ts", "mts", "m2ts",
]);

const AUDIO_EXTS = new Set([
  "mp3", "flac", "m4a", "aac", "ogg", "opus", "wma", "wav", "ape", "alac", "aiff", "dsf", "dff",
]);

const PDF_EXTS = new Set(["pdf"]);

const isSupportedForThumbnail = (ext: string | null): boolean => {
  if (!ext) return false;
  const lower = ext.toLowerCase();
  return IMAGE_EXTS.has(lower) || VIDEO_EXTS.has(lower) || AUDIO_EXTS.has(lower) || PDF_EXTS.has(lower);
};

// 注意：getLibraryRoot 已统一从 core/middleware 导入

// 根据文件扩展名获取对应的缩略图后缀
const getThumbnailExt = (ext: string | null): string => {
  if (!ext) return THUMBNAIL_EXT_IMAGE;
  const lower = ext.toLowerCase();
  if (VIDEO_EXTS.has(lower)) return THUMBNAIL_EXT_VIDEO;
  if (IMAGE_EXTS.has(lower)) return THUMBNAIL_EXT_IMAGE;
  if (AUDIO_EXTS.has(lower)) return THUMBNAIL_EXT_AUDIO;
  if (PDF_EXTS.has(lower)) return THUMBNAIL_EXT_PDF;
  return THUMBNAIL_EXT_IMAGE;
};

// 根据 entryId 和扩展名构建缩略图路径
const getThumbnailPath = async (libraryRoot: string, entryId: string, ext: string | null): Promise<string> => {
  const thumbExt = getThumbnailExt(ext);
  return resolveMutationPathWithinLibrary(libraryRoot, path.join(INTERNAL_META_DIR, THUMBNAILS_DIR_NAME, assertValidPathSegment(`${entryId}${thumbExt}`)));
};

// 根据 entry 构建实际文件路径（非侵入式：直接使用 original_name）
const buildRealPathFromEntryRow = async (
  libraryRoot: string,
  entryRow: any,
): Promise<string> => {
  const entry = getEntryById(entryRow.id);
  if (!entry) throw new Error("文件不存在或已删除");
  return resolveRealPathForEntry(entry, libraryRoot);
};

// 等待进程退出后再执行异步文件操作，避免事件回调中的拒绝丢失
const runThumbnailProcess = (args: string[]): Promise<number | null> => {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", resolve);
  });
};

const getTemporaryThumbnailPath = async (finalOutputPath: string): Promise<string> => {
  const outputDir = path.dirname(finalOutputPath);
  await fs.mkdir(outputDir, { recursive: true });
  return resolveMutationPathWithinLibrary(outputDir, path.basename(finalOutputPath.replace(/\.[^.]+$/, ".jpg")));
};

const promoteThumbnail = async (
  tempOutputPath: string,
  finalOutputPath: string,
  minimumSize: number,
): Promise<boolean> => {
  try {
    if ((await fs.stat(tempOutputPath)).size > minimumSize) {
      if (tempOutputPath !== finalOutputPath) {
        await fs.rename(tempOutputPath, finalOutputPath);
      }
      return true;
    }
  } catch {
    // 无效或未成功生成的文件交由下面的清理处理
  }
  await fs.unlink(tempOutputPath).catch(() => {});
  return false;
};

// 使用 ffmpeg 提取音频文件的嵌入封面
const extractAudioCover = async (
  inputPath: string,
  finalOutputPath: string,
): Promise<boolean> => {
  const tempOutputPath = await getTemporaryThumbnailPath(finalOutputPath);
  try {
    await runThumbnailProcess([
      "-y", "-i", inputPath,
      "-an", "-vcodec", "mjpeg",
      "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
      "-frames:v", "1", tempOutputPath,
    ]);
  } catch {
    await fs.unlink(tempOutputPath).catch(() => {});
    return false;
  }
  return promoteThumbnail(tempOutputPath, finalOutputPath, 100);
};

// 使用 ffmpeg 生成 PDF 首页预览图
const generatePdfThumbnail = async (
  inputPath: string,
  finalOutputPath: string,
): Promise<void> => {
  const tempOutputPath = await getTemporaryThumbnailPath(finalOutputPath);
  const code = await runThumbnailProcess([
    "-y", "-i", inputPath,
    "-frames:v", "1",
    "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
    tempOutputPath,
  ]);
  if (!(await promoteThumbnail(tempOutputPath, finalOutputPath, 100))) {
    throw new Error(`PDF 缩略图生成失败，退出码 ${code}`);
  }
};

// 视频先尝试第 5 秒，失败再从头开始；成功后才发布目标文件
const generateThumbnailWithFfmpeg = async (
  inputPath: string,
  finalOutputPath: string,
  isVideo: boolean,
): Promise<void> => {
  const tempOutputPath = await getTemporaryThumbnailPath(finalOutputPath);
  const runFfmpeg = async (seekTime: string | null): Promise<void> => {
    const args = ["-y"];
    if (seekTime) args.push("-ss", seekTime);
    args.push(
      "-i", inputPath,
      "-frames:v", "1",
      "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
      tempOutputPath,
    );
    const code = await runThumbnailProcess(args);
    // 非零退出码仍可能生成有效图片，保留原有行为
    const outputStat = await fs.stat(tempOutputPath).catch(() => null);
    if (!outputStat || outputStat.size <= 0) {
      throw new Error(`ffmpeg 退出码 ${code}`);
    }
  };

  if (isVideo) {
    try {
      await runFfmpeg("00:00:05");
    } catch {
      await runFfmpeg(null);
    }
  } else {
    await runFfmpeg(null);
  }
  if (tempOutputPath !== finalOutputPath) {
    await fs.rename(tempOutputPath, finalOutputPath);
  }
};

// 缩略图生成任务处理
export const handleGenerateThumbnailTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("缩略图任务缺少合法的文件索引 ID");
  }

  const entryStmt = db.prepare(
    "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, is_deleted FROM file_entries WHERE id = ?",
  );

  const entryRow = entryStmt.get(entryId) as
    | {
        id: string;
        library_id: number;
        parent_id: string | null;
        is_directory: number;
        original_name: string;
        index_suffix: string | null;
        extension: string | null;
        is_deleted: number;
      }
    | undefined;

  if (!entryRow) {
    log.warn(`文件条目不存在: ${entryId}`);
    return;
  }

  if (entryRow.is_directory || entryRow.is_deleted) {
    return;
  }

  if (!isSupportedForThumbnail(entryRow.extension)) {
    return;
  }

  const libraryRoot = await getLibraryRoot(entryRow.library_id);
  const thumbnailPath = await getThumbnailPath(libraryRoot, entryId, entryRow.extension);

  if ((await pathExists(thumbnailPath))) {
    return;
  }

  const fullPath = await buildRealPathFromEntryRow(libraryRoot, entryRow);

  if (!(await pathExists(fullPath))) {
    throw new Error("原始文件不存在，无法生成缩略图");
  }

  log.info(`生成缩略图: ${entryRow.original_name}`);
  const extLower = entryRow.extension?.toLowerCase() || "";
  
  if (VIDEO_EXTS.has(extLower)) {
    await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, true);
  } else if (IMAGE_EXTS.has(extLower)) {
    await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, false);
  } else if (AUDIO_EXTS.has(extLower)) {
    const success = await extractAudioCover(fullPath, thumbnailPath);
    if (!success) {
      return;
    }
  } else if (PDF_EXTS.has(extLower)) {
    try {
      await generatePdfThumbnail(fullPath, thumbnailPath);
    } catch {
      return;
    }
  }
};

// ============================================================================
// 供索引任务直接调用的缩略图生成函数（不创建独立任务）
// ============================================================================

export const generateThumbnailForEntry = async (entryId: string): Promise<void> => {
  const entryStmt = db.prepare(
    "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, is_deleted FROM file_entries WHERE id = ?",
  );

  const entryRow = entryStmt.get(entryId) as
    | {
        id: string;
        library_id: number;
        parent_id: string | null;
        is_directory: number;
        original_name: string;
        index_suffix: string | null;
        extension: string | null;
        is_deleted: number;
      }
    | undefined;

  if (!entryRow) {
    throw new Error("文件条目不存在");
  }

  if (entryRow.is_directory || entryRow.is_deleted) {
    throw new Error("目录或已删除条目不支持生成缩略图");
  }

  if (!isSupportedForThumbnail(entryRow.extension)) {
    throw new Error("不支持的文件类型");
  }

  const libraryRoot = await getLibraryRoot(entryRow.library_id);
  const thumbnailPath = await getThumbnailPath(libraryRoot, entryId, entryRow.extension);

  // 已存在缩略图则跳过
  if ((await pathExists(thumbnailPath))) {
    const stat = await fs.stat(thumbnailPath);
    if (stat.size > 1024) {
      return; // 缩略图已存在且有效
    }
  }

  const fullPath = await buildRealPathFromEntryRow(libraryRoot, entryRow);

  if (!(await pathExists(fullPath))) {
    throw new Error("原始文件不存在，无法生成缩略图");
  }

  const extLower = entryRow.extension?.toLowerCase() || "";
  
  if (VIDEO_EXTS.has(extLower)) {
    await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, true);
  } else if (IMAGE_EXTS.has(extLower)) {
    await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, false);
  } else if (AUDIO_EXTS.has(extLower)) {
    const success = await extractAudioCover(fullPath, thumbnailPath);
    if (!success) {
      throw new Error("音频文件没有嵌入封面");
    }
  } else if (PDF_EXTS.has(extLower)) {
    await generatePdfThumbnail(fullPath, thumbnailPath);
  }
};
