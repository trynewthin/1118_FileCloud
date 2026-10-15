import fs from "node:fs/promises";
import { pathExists } from "../../core/fs.ts";
import path from "node:path";
import { spawn } from "node:child_process";
import { db } from "../../core/db/index.ts";
import { assertSafeDirectoryTree, assertValidPathSegment, resolveMutationPathWithinLibrary, resolvePathWithinLibrary } from "../../core/config/pathSecurity.ts";
import { getEntryById, resolveRealPathForEntry } from "../files/index.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";
import { createLogger } from "../../core/logger/index.ts";

const logger = createLogger("Transcode");

// ============================================================================
// 配置常量
// ============================================================================

const INTERNAL_META_DIR = ".filecloud_meta";
const TRANSCODED_DIR_NAME = "transcoded";
const TRANSCODE_EXT = ".webcompat";  // 转码文件后缀（不直接显示 .mp4）

// 转码参数：限制 1080p，中等质量
const FFMPEG_PRESET = "fast";        // 编码速度预设
const FFMPEG_CRF = "28";             // 质量因子（越大越小/越模糊，23-28 适中）
const MAX_HEIGHT = 1080;             // 最大高度
const MAX_WIDTH = 1920;              // 最大宽度

// ============================================================================
// 类型定义
// ============================================================================

export type TranscodeStatus = "pending" | "processing" | "completed" | "failed";

export interface TranscodeRecord {
  id: number;
  entry_id: string;
  library_id: number;
  status: TranscodeStatus;
  progress: number;
  output_path: string | null;
  output_size: number | null;
  error_message: string | null;
  task_id: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// 数据库操作
// ============================================================================

const mapRowToTranscode = (row: any): TranscodeRecord => ({
  id: row.id,
  entry_id: row.entry_id,
  library_id: row.library_id,
  status: row.status,
  progress: row.progress,
  output_path: row.output_path ?? null,
  output_size: row.output_size ?? null,
  error_message: row.error_message ?? null,
  task_id: row.task_id ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// 获取文件的转码记录
export const getTranscodeForEntry = (entryId: string): TranscodeRecord | null => {
  const row = db
    .prepare("SELECT * FROM file_transcodes WHERE entry_id = ?")
    .get(entryId);
  return row ? mapRowToTranscode(row) : null;
};

// 创建或重置转码记录
export const createOrResetTranscode = (
  entryId: string,
  libraryId: number,
  taskId: number,
): TranscodeRecord => {
  const now = new Date().toISOString();
  const existing = getTranscodeForEntry(entryId);

  if (existing) {
    // 重置现有记录
    db.prepare(
      "UPDATE file_transcodes SET status = 'pending', progress = 0, output_path = NULL, output_size = NULL, error_message = NULL, task_id = ?, updated_at = ? WHERE entry_id = ?",
    ).run(taskId, now, entryId);
  } else {
    // 创建新记录
    db.prepare(
      "INSERT INTO file_transcodes(entry_id, library_id, status, progress, task_id, created_at, updated_at) VALUES(?, ?, 'pending', 0, ?, ?, ?)",
    ).run(entryId, libraryId, taskId, now, now);
  }

  return getTranscodeForEntry(entryId)!;
};

// 更新转码进度
export const updateTranscodeProgress = (entryId: string, progress: number): void => {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE file_transcodes SET status = 'processing', progress = ?, updated_at = ? WHERE entry_id = ?",
  ).run(progress, now, entryId);
};

// 标记转码完成
export const markTranscodeCompleted = (
  entryId: string,
  outputPath: string,
  outputSize: number,
): void => {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE file_transcodes SET status = 'completed', progress = 100, output_path = ?, output_size = ?, updated_at = ? WHERE entry_id = ?",
  ).run(outputPath, outputSize, now, entryId);
};

// 标记转码失败
export const markTranscodeFailed = (entryId: string, errorMessage: string): void => {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE file_transcodes SET status = 'failed', error_message = ?, updated_at = ? WHERE entry_id = ?",
  ).run(errorMessage, now, entryId);
};

// 删除转码记录（原始文件被删除时调用）
export const deleteTranscodeForEntry = async (entryId: string): Promise<void> => {
  const record = getTranscodeForEntry(entryId);
  if (record?.output_path) {
    // 尝试删除转码文件
    try {
      const entry = getEntryById(entryId);
      if (entry) {
        const rootPath = await getLibraryRoot(entry.library_id);
        const fullPath = await resolveMutationPathWithinLibrary(rootPath, path.join(INTERNAL_META_DIR, TRANSCODED_DIR_NAME, assertValidPathSegment(record.output_path)));
        if (await pathExists(fullPath)) {
          await fs.unlink(fullPath);
        }
      }
    } catch (err) {
      logger.error("删除转码文件失败", err);
    }
  }
  db.prepare("DELETE FROM file_transcodes WHERE entry_id = ?").run(entryId);
};

// 清理指定文件库的所有转码记录和文件
export const cleanupTranscodesForLibrary = async (libraryId: number): Promise<number> => {
  // 获取该库的所有转码记录
  const records = db
    .prepare("SELECT * FROM file_transcodes WHERE library_id = ?")
    .all(libraryId) as any[];

  let deletedCount = 0;

  // 尝试删除转码文件
  try {
    const library = db
      .prepare("SELECT root_path FROM file_libraries WHERE id = ?")
      .get(libraryId) as { root_path: string } | undefined;

    if (library) {
      const transcodedDir = await resolveMutationPathWithinLibrary(library.root_path, path.join(INTERNAL_META_DIR, TRANSCODED_DIR_NAME));
      if (await pathExists(transcodedDir)) {
        // 删除整个转码目录
        await assertSafeDirectoryTree(library.root_path, transcodedDir);
        await fs.rm(transcodedDir, { recursive: true, force: true });
      }
    }
  } catch (err) {
    logger.error("清理转码目录失败", err);
  }

  // 删除数据库记录
  const result = db
    .prepare("DELETE FROM file_transcodes WHERE library_id = ?")
    .run(libraryId);
  deletedCount = result.changes;

  logger.info(`清理文件库 ${libraryId} 的转码记录: ${deletedCount} 条`);
  return deletedCount;
};

// ============================================================================
// 转码核心逻辑
// ============================================================================

// 获取转码输出目录
const getTranscodedDir = async (libraryRootPath: string): Promise<string> => {
  const dir = await resolveMutationPathWithinLibrary(libraryRootPath, path.join(INTERNAL_META_DIR, TRANSCODED_DIR_NAME));
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

// 获取转码输出文件名
const getTranscodedFileName = (entryId: string): string => {
  return assertValidPathSegment(`${entryId}${TRANSCODE_EXT}`);
};

// 执行 FFmpeg 转码
export const executeTranscode = async (
  entryId: string,
  onProgress?: (progress: number) => void,
): Promise<{ success: boolean; outputPath?: string; outputSize?: number; error?: string }> => {
  const entry = getEntryById(entryId);
  if (!entry) {
    return { success: false, error: "文件不存在" };
  }

  if (entry.is_directory) {
    return { success: false, error: "不支持对目录进行转码" };
  }

  const rootPath = await getLibraryRoot(entry.library_id);
  const inputPath = await resolveRealPathForEntry(entry, rootPath);

  if (!(await pathExists(inputPath))) {
    return { success: false, error: "源文件不存在" };
  }

  const transcodedDir = await getTranscodedDir(rootPath);
  const outputFileName = getTranscodedFileName(entryId);
  const outputPath = await resolveMutationPathWithinLibrary(rootPath, path.relative(rootPath, path.join(transcodedDir, outputFileName)));

  // 临时输出路径（.mp4 后缀，让 FFmpeg 自动识别格式）
  const tempOutputPath = await resolveMutationPathWithinLibrary(rootPath, path.relative(rootPath, outputPath.replace(/\.webcompat$/, ".mp4")));

  // 如果已存在旧的转码文件，先删除
  if (await pathExists(outputPath)) {
    await fs.unlink(outputPath);
  }
  if (await pathExists(tempOutputPath)) {
    await fs.unlink(tempOutputPath);
  }

  let stderrLog = ""; // 收集完整日志
  const result = await new Promise<{ code: number | null; error?: Error }>((resolve) => {
    // 1080p 转码，宽度自动适应且为偶数 (-2)
    const ffmpegArgs = [
      "-i", inputPath,
      "-c:v", "libx264",
      "-preset", FFMPEG_PRESET,
      "-crf", FFMPEG_CRF,
      "-vf", "scale=-2:1080",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      "-progress", "pipe:1",
      tempOutputPath, // 先输出为 .mp4
    ];

    logger.debug(`启动 FFmpeg: ffmpeg ${ffmpegArgs.join(" ")}`);

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let duration = 0;
    let lastProgress = 0;
    let progressError: Error | undefined;

    // 解析 stderr 获取总时长，同时收集日志
    ffmpeg.stderr.on("data", (data: Buffer) => {
      const str = data.toString();
      stderrLog += str; // 收集日志
      
      // 解析 Duration: 00:01:23.45
      const durationMatch = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/.exec(str);
      if (durationMatch && durationMatch[1] && durationMatch[2] && durationMatch[3]) {
        const hours = parseInt(durationMatch[1], 10);
        const minutes = parseInt(durationMatch[2], 10);
        const seconds = parseInt(durationMatch[3], 10);
        duration = hours * 3600 + minutes * 60 + seconds;
      }
    });

    // 解析 stdout 获取进度
    ffmpeg.stdout.on("data", (data: Buffer) => {
      const str = data.toString();
      // 解析 out_time_ms=12345678
      const timeMatch = /out_time_ms=(\d+)/.exec(str);
      if (timeMatch && timeMatch[1] && duration > 0) {
        const currentMs = parseInt(timeMatch[1], 10);
        const currentSec = currentMs / 1000000;
        const progress = Math.min(99, Math.floor((currentSec / duration) * 100));
        if (progress > lastProgress) {
          lastProgress = progress;
          try {
            onProgress?.(progress);
          } catch (error) {
            // 取消/进度回调失败必须进入任务失败及临时文件清理路径
            progressError = error instanceof Error ? error : new Error(String(error));
            ffmpeg.kill();
          }
        }
      }
    });

    ffmpeg.once("error", (error) => resolve({ code: null, error }));
    ffmpeg.once("close", (code) => resolve({ code, error: progressError }));
  });

  if (result.error) {
    logger.error("FFmpeg 执行失败", result.error);
    await fs.unlink(tempOutputPath).catch(() => {});
    return { success: false, error: `FFmpeg 执行失败: ${result.error.message}` };
  }

  if (result.code === 0) {
    // 文件操作在进程 Promise 完成后执行，失败始终返回给任务调用者
    try {
      await fs.rename(tempOutputPath, outputPath);
      const stat = await fs.stat(outputPath);
      onProgress?.(100);
      return { success: true, outputPath: outputFileName, outputSize: stat.size };
    } catch (error: any) {
      logger.error("转码输出处理失败", error);
      await fs.unlink(tempOutputPath).catch(() => {});
      return { success: false, error: `转码输出处理失败: ${error.message}` };
    }
  }

  logger.error(`FFmpeg 失败，退出码: ${result.code}`);
  logger.error(`错误日志 (Last 20 lines):\n${stderrLog.split("\n").slice(-20).join("\n")}`);
  await fs.unlink(tempOutputPath).catch(() => {});
  const shortLog = stderrLog.split("\n").slice(-5).join("\n");
  return { success: false, error: `FFmpeg 退出码 ${result.code}: ${shortLog}` };
};

// ============================================================================
// 获取转码版本的流式播放路径
// ============================================================================

export const getTranscodedFilePath = async (entryId: string): Promise<string | null> => {
  const record = getTranscodeForEntry(entryId);
  if (!record || record.status !== "completed" || !record.output_path) {
    return null;
  }

  const entry = getEntryById(entryId);
  if (!entry) {
    return null;
  }

  const rootPath = await getLibraryRoot(entry.library_id);
  const fullPath = await resolvePathWithinLibrary(rootPath, path.join(INTERNAL_META_DIR, TRANSCODED_DIR_NAME, assertValidPathSegment(record.output_path)));

  if (!(await pathExists(fullPath))) {
    // 转码文件不存在，清理记录
    await deleteTranscodeForEntry(entryId);
    return null;
  }

  return fullPath;
};

// 检查文件是否需要转码（MKV 等格式）
export const needsTranscode = (extension: string | null): boolean => {
  if (!extension) return false;
  const ext = extension.toLowerCase();
  // 需要转码的格式
  return ["mkv", "avi", "wmv", "flv", "mov", "webm", "ogv"].includes(ext);
};
