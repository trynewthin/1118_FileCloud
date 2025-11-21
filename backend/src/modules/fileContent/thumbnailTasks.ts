import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { db } from "../../core/db/index.ts";
import { registerTaskHandler } from "../../core/tasks/executor.ts";
import type { TaskRecord } from "../tasks/service.ts";
import { updateTaskStatus } from "../tasks/service.ts";

// 缩略图相关任务类型常量
export const TASK_TYPE_FILE_GENERATE_THUMBNAIL = "FILE_GENERATE_THUMBNAIL";

const INTERNAL_META_DIR = ".filecloud_meta";
const THUMBNAILS_DIR_NAME = "thumbnails";

// 支持生成缩略图的扩展名（不带点，小写）
const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
]);

const VIDEO_EXTS = new Set([
  "mp4",
  "webm",
  "ogv",
  "mov",
  "mkv",
  "avi",
]);

const isSupportedForThumbnail = (ext: string | null): boolean => {
  if (!ext) return false;
  const lower = ext.toLowerCase();
  return IMAGE_EXTS.has(lower) || VIDEO_EXTS.has(lower);
};

// 查询文件库根路径
const getLibraryRoot = (libraryId: number): string => {
  const row = db
    .prepare(
      "SELECT id, root_path, is_enabled FROM file_libraries WHERE id = ? LIMIT 1",
    )
    .get(libraryId) as { id: number; root_path: string; is_enabled: number } | undefined;

  if (!row) {
    throw new Error("文件库不存在");
  }

  if (!row.is_enabled) {
    throw new Error("文件库未启用");
  }

  return row.root_path;
};

// 根据 entryId 构建缩略图路径
const getThumbnailPath = (libraryRoot: string, entryId: string): string => {
  return path.join(libraryRoot, INTERNAL_META_DIR, THUMBNAILS_DIR_NAME, `${entryId}.jpg`);
};

// 根据 entry 构建实际文件路径
const buildRealPathFromEntryRow = (
  libraryRoot: string,
  entryRow: any,
  stmt: any,
): string => {
  const segments: string[] = [];
  let current: any | undefined = entryRow;

  while (current) {
    segments.unshift(current.original_name);
    if (!current.parent_id) break;
    const parentRow = stmt.get(current.parent_id) as any | undefined;
    if (!parentRow) break;
    current = parentRow;
  }

  return path.join(libraryRoot, ...segments);
};

// 使用 ffmpeg 生成缩略图（对于视频，尝试截取第 5 秒以避免黑屏）
const generateThumbnailWithFfmpeg = async (
  inputPath: string,
  outputPath: string,
  isVideo: boolean,
): Promise<void> => {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const args = [
      "-y", // 覆盖输出
    ];

    // 如果是视频，尝试跳过前 5 秒；如果是图片，则无需 seek
    if (isVideo) {
      args.push("-ss", "00:00:05");
    }

    args.push(
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=320:-1:force_original_aspect_ratio=decrease",
      outputPath,
    );

    const child = spawn("ffmpeg", args, { stdio: "ignore" });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // 如果 seek 失败（例如视频短于 5 秒），可能会导致无输出或错误
        // 这里可以做一个简单的回退策略：如果不成功且是视频，尝试 seek 0
        if (isVideo && !fs.existsSync(outputPath)) {
          // Fallback to 00:00:00
          const fallbackArgs = [
            "-y", "-i", inputPath, "-frames:v", "1",
            "-vf", "scale=320:-1:force_original_aspect_ratio=decrease",
            outputPath
          ];
          const fallbackChild = spawn("ffmpeg", fallbackArgs, { stdio: "ignore" });
          fallbackChild.on("close", (fbCode) => {
            if (fbCode === 0) resolve();
            else reject(new Error(`ffmpeg fallback failed with code ${fbCode}`));
          });
        } else {
          reject(new Error(`ffmpeg 退出码 ${code}`));
        }
      }
    });
  });
};

// 缩略图生成任务处理
const handleGenerateThumbnailTask = async (task: TaskRecord) => {
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("缩略图任务缺少合法的文件索引 ID");
  }

  const entryStmt = db.prepare(
    "SELECT id, library_id, parent_id, is_directory, original_name, extension, is_deleted FROM file_entries WHERE id = ?",
  );

  const entryRow = entryStmt.get(entryId) as
    | {
        id: string;
        library_id: number;
        parent_id: string | null;
        is_directory: number;
        original_name: string;
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
  const thumbnailPath = getThumbnailPath(libraryRoot, entryId);

  // 已存在缩略图则跳过
  if (fs.existsSync(thumbnailPath)) {
    return;
  }

  const pathStmt = db.prepare(
    "SELECT id, library_id, parent_id, is_directory, original_name FROM file_entries WHERE id = ?",
  );

  const fullPath = buildRealPathFromEntryRow(libraryRoot, entryRow, pathStmt);

  if (!fs.existsSync(fullPath)) {
    throw new Error("原始文件不存在，无法生成缩略图");
  }

  const isVideo = VIDEO_EXTS.has(entryRow.extension?.toLowerCase() || "");
  await generateThumbnailWithFfmpeg(fullPath, thumbnailPath, isVideo);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

// 注册缩略图任务处理器
export const registerThumbnailTaskHandlers = () => {
  registerTaskHandler(TASK_TYPE_FILE_GENERATE_THUMBNAIL, handleGenerateThumbnailTask);
};
