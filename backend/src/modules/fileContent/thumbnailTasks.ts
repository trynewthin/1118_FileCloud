import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { db } from "../../core/db/index.ts";
// 注意：已移除 indexSuffix 导入，采用非侵入式索引策略
import { registerTaskHandler } from "../../core/tasks/executor.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";
import type { TaskRecord } from "../tasks/service.ts";
import { updateTaskStatus } from "../tasks/service.ts";

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
const getThumbnailPath = (libraryRoot: string, entryId: string, ext: string | null): string => {
  const thumbExt = getThumbnailExt(ext);
  return path.join(libraryRoot, INTERNAL_META_DIR, THUMBNAILS_DIR_NAME, `${entryId}${thumbExt}`);
};

// 根据 entry 构建实际文件路径（非侵入式：直接使用 original_name）
const buildRealPathFromEntryRow = (
  libraryRoot: string,
  entryRow: any,
  stmt: any,
): string => {
  const segments: string[] = [];
  let current: any | undefined = entryRow;

  while (current) {
    // 非侵入式索引：直接使用原始文件名
    segments.unshift(current.original_name);
    if (!current.parent_id) break;
    const parentRow = stmt.get(current.parent_id) as any | undefined;
    if (!parentRow) break;
    current = parentRow;
  }

  return path.join(libraryRoot, ...segments);
};

// 使用 ffmpeg 提取音频文件的嵌入封面
const extractAudioCover = async (
  inputPath: string,
  finalOutputPath: string,
): Promise<boolean> => {
  const outputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tempOutputPath = finalOutputPath.replace(/\.[^.]+$/, ".jpg");

  return new Promise((resolve) => {
    // 尝试提取嵌入的封面图片
    const args = [
      "-y",
      "-i", inputPath,
      "-an",                    // 禁用音频
      "-vcodec", "mjpeg",       // 输出 JPEG
      "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
      "-frames:v", "1",
      tempOutputPath,
    ];

    const child = spawn("ffmpeg", args, { stdio: "ignore" });

    child.on("error", () => resolve(false));
    child.on("close", () => {
      if (fs.existsSync(tempOutputPath)) {
        try {
          const stat = fs.statSync(tempOutputPath);
          if (stat.size > 100) {
            // 成功提取到封面
            if (tempOutputPath !== finalOutputPath) {
              fs.renameSync(tempOutputPath, finalOutputPath);
            }
            resolve(true);
            return;
          }
        } catch {
          // 忽略
        }
        // 文件太小，可能是空的，删除它
        try { fs.unlinkSync(tempOutputPath); } catch { /* 忽略 */ }
      }
      resolve(false);
    });
  });
};

// 使用 ffmpeg 生成 PDF 首页预览图
const generatePdfThumbnail = async (
  inputPath: string,
  finalOutputPath: string,
): Promise<void> => {
  const outputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tempOutputPath = finalOutputPath.replace(/\.[^.]+$/, ".jpg");

  return new Promise((resolve, reject) => {
    // ffmpeg 可以读取 PDF 首页（需要系统安装了 poppler 或 ffmpeg 编译时启用了 PDF 支持）
    const args = [
      "-y",
      "-i", inputPath,
      "-frames:v", "1",
      "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
      tempOutputPath,
    ];

    const child = spawn("ffmpeg", args, { stdio: "ignore" });

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (fs.existsSync(tempOutputPath)) {
        try {
          const stat = fs.statSync(tempOutputPath);
          if (stat.size > 100) {
            if (tempOutputPath !== finalOutputPath) {
              fs.renameSync(tempOutputPath, finalOutputPath);
            }
            resolve();
            return;
          }
        } catch {
          // 忽略
        }
        try { fs.unlinkSync(tempOutputPath); } catch { /* 忽略 */ }
      }
      reject(new Error(`PDF 缩略图生成失败，退出码 ${code}`));
    });
  });
};

// 使用 ffmpeg 生成缩略图（对于视频，尝试截取第 5 秒以避免黑屏）
// 先生成 .jpg 临时文件，成功后重命名为目标后缀
const generateThumbnailWithFfmpeg = async (
  inputPath: string,
  finalOutputPath: string,
  isVideo: boolean,
): Promise<void> => {
  const outputDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 临时文件使用 .jpg 后缀，让 ffmpeg 自动识别格式
  const tempOutputPath = finalOutputPath.replace(/\.[^.]+$/, ".jpg");

  const runFfmpeg = (seekTime: string | null): Promise<void> => {
    return new Promise((resolve, reject) => {
      const args = ["-y"]; // 覆盖输出

      if (seekTime) {
        args.push("-ss", seekTime);
      }

      args.push(
        "-i", inputPath,
        "-frames:v", "1",
        "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
        tempOutputPath,
      );

      const child = spawn("ffmpeg", args, { stdio: "ignore" });

      child.on("error", (err) => reject(err));
      child.on("close", (code) => {
        // 如果已经成功生成了非空的缩略图文件，则视为成功，忽略非 0 退出码
        if (fs.existsSync(tempOutputPath)) {
          try {
            const stat = fs.statSync(tempOutputPath);
            if (stat.size > 0) {
              resolve();
              return;
            }
          } catch {
            // stat 失败则继续按退出码处理
          }
        }

        reject(new Error(`ffmpeg 退出码 ${code}`));
      });
    });
  };

  // 视频先尝试 seek 到 5 秒，失败则从头开始
  if (isVideo) {
    try {
      await runFfmpeg("00:00:05");
    } catch {
      await runFfmpeg(null);
    }
  } else {
    await runFfmpeg(null);
  }

  // 生成成功后，重命名为目标后缀
  if (tempOutputPath !== finalOutputPath) {
    fs.renameSync(tempOutputPath, finalOutputPath);
  }
};

// 缩略图生成任务处理
const handleGenerateThumbnailTask = async (task: TaskRecord) => {
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
    // 找不到条目，视为无需处理
    return;
  }

  if (entryRow.is_directory || entryRow.is_deleted) {
    // 目录或已删除条目不生成缩略图
    return;
  }

  if (!isSupportedForThumbnail(entryRow.extension)) {
    return;
  }

  const libraryRoot = getLibraryRoot(entryRow.library_id);
  const thumbnailPath = getThumbnailPath(libraryRoot, entryId, entryRow.extension);

  // 已存在缩略图则跳过
  if (fs.existsSync(thumbnailPath)) {
    return;
  }

  const pathStmt = db.prepare(
    "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix FROM file_entries WHERE id = ?",
  );

  const fullPath = buildRealPathFromEntryRow(libraryRoot, entryRow, pathStmt);

  if (!fs.existsSync(fullPath)) {
    throw new Error("原始文件不存在，无法生成缩略图");
  }

  const extLower = entryRow.extension?.toLowerCase() || "";
  
  if (VIDEO_EXTS.has(extLower)) {
    await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, true);
  } else if (IMAGE_EXTS.has(extLower)) {
    await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, false);
  } else if (AUDIO_EXTS.has(extLower)) {
    // 音频文件：尝试提取嵌入封面，失败则跳过（不报错）
    const success = await extractAudioCover(fullPath, thumbnailPath);
    if (!success) {
      // 没有嵌入封面，跳过
      return;
    }
  } else if (PDF_EXTS.has(extLower)) {
    // PDF 文件：生成首页预览
    try {
      await generatePdfThumbnail(fullPath, thumbnailPath);
    } catch {
      // PDF 缩略图生成失败，跳过（可能 ffmpeg 不支持 PDF）
      return;
    }
  }

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

// 注册缩略图任务处理器
export const registerThumbnailTaskHandlers = () => {
  registerTaskHandler(TASK_TYPE_FILE_GENERATE_THUMBNAIL, handleGenerateThumbnailTask);
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

  const libraryRoot = getLibraryRoot(entryRow.library_id);
  const thumbnailPath = getThumbnailPath(libraryRoot, entryId, entryRow.extension);

  // 已存在缩略图则跳过
  if (fs.existsSync(thumbnailPath)) {
    const stat = fs.statSync(thumbnailPath);
    if (stat.size > 1024) {
      return; // 缩略图已存在且有效
    }
  }

  const pathStmt = db.prepare(
    "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix FROM file_entries WHERE id = ?",
  );

  const fullPath = buildRealPathFromEntryRow(libraryRoot, entryRow, pathStmt);

  if (!fs.existsSync(fullPath)) {
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
