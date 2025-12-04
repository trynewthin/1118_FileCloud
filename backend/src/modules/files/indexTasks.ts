import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../../core/db/index.ts";
import { registerTaskHandler } from "../../core/tasks/executor.ts";
import type { TaskRecord, DetailProgress } from "../tasks/service.ts";
import { updateTaskStatus, updateTaskDetailProgress, createTask } from "../tasks/service.ts";
// 注意：已移除 indexSuffix 相关导入，采用非侵入式索引策略
// 物理文件保持原始名称，不再添加 [xxxxxx] 后缀
import { rebuildFtsIndexForLibrary } from "./ftsService.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";
import { cleanupTranscodesForLibrary } from "../fileContent/transcodeService.ts";

// ============================================================================
// 任务类型常量
// ============================================================================
export const TASK_TYPE_FILE_INDEX_LIBRARY = "FILE_INDEX_LIBRARY";
export const TASK_TYPE_FILE_INDEX_SINGLE = "FILE_INDEX_SINGLE";

// 内部子任务类型（不单独显示，作为索引任务的子任务）
const TASK_TYPE_INDEX_SCAN = "INDEX_SCAN"; // 文件扫描阶段
const TASK_TYPE_INDEX_THUMBNAIL = "INDEX_THUMBNAIL"; // 缩略图生成阶段

// ============================================================================
// 配置常量
// ============================================================================
const INTERNAL_META_DIR = ".filecloud_meta";
const THUMBNAILS_DIR_NAME = "thumbnails";

// 缩略图文件后缀（按文件类型区分）
const THUMBNAIL_EXT_VIDEO = ".vedtb";  // 视频缩略图
const THUMBNAIL_EXT_IMAGE = ".photb";  // 图片缩略图

// ============================================================================
// 文件类型索引策略
// 按扩展名分类，不同类型可执行不同的索引方案
// ============================================================================

// 支持生成缩略图的扩展名（不带点，小写）
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "ico", "heic", "heif"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "ogv", "mov", "mkv", "avi", "wmv", "flv", "m4v"]);

// 预留：音频文件（未来可提取封面、波形图等）
const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"]);

// 预留：文档文件（未来可提取预览图、元数据等）
const DOCUMENT_EXTS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"]);

// 文件类型枚举
type FileCategory = "image" | "video" | "audio" | "document" | "other";

const getFileCategory = (ext: string | null): FileCategory => {
  if (!ext) return "other";
  const lower = ext.toLowerCase();
  if (IMAGE_EXTS.has(lower)) return "image";
  if (VIDEO_EXTS.has(lower)) return "video";
  if (AUDIO_EXTS.has(lower)) return "audio";
  if (DOCUMENT_EXTS.has(lower)) return "document";
  return "other";
};

const needsThumbnail = (category: FileCategory): boolean => {
  return category === "image" || category === "video";
};

// ============================================================================
// 数据库辅助函数
// ============================================================================

// 注意：getLibraryRoot 已统一从 core/middleware 导入

// 根据原始名称在指定父目录下查找已存在的索引记录
const findEntryByName = (
  libraryId: number,
  parentId: string | null,
  originalName: string,
): { id: string; original_name: string } | null => {
  const row = db
    .prepare(
      "SELECT id, original_name FROM file_entries WHERE library_id = ? AND parent_id IS ? AND original_name = ? AND is_deleted = 0 LIMIT 1",
    )
    .get(libraryId, parentId, originalName) as
    | { id: string; original_name: string }
    | undefined;
  return row ?? null;
};


/**
 * 处理目录索引（非侵入式：不修改物理目录名）
 * @param libraryId 文件库 ID
 * @param parentId 父目录 ID
 * @param dirName 目录名
 * @returns entryId
 */
const processDirectoryEntry = (
  libraryId: number,
  parentId: string | null,
  dirName: string,
): string => {
  const now = new Date().toISOString();

  // 按原始名称查找已存在的记录
  const existing = findEntryByName(libraryId, parentId, dirName);
  if (existing) {
    // 更新已有记录
    db.prepare(
      "UPDATE file_entries SET is_directory = 1, is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?",
    ).run(now, existing.id);
    return existing.id;
  }

  // 创建新记录（不生成 index_suffix）
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 1, ?, NULL, NULL, 0, NULL, 0, ?, ?)",
  ).run(id, libraryId, parentId, dirName, now, now);
  return id;
};

/**
 * 处理文件索引（非侵入式：不修改物理文件名）
 * @returns { entryId, isNew }
 */
const processFileEntry = (
  libraryId: number,
  parentId: string | null,
  fileName: string,
  size: number,
): { entryId: string; isNew: boolean } => {
  const now = new Date().toISOString();
  const extension = path.extname(fileName).toLowerCase().replace(/^\./, "") || null;

  // 按原始名称查找已存在的记录
  const existing = findEntryByName(libraryId, parentId, fileName);
  if (existing) {
    // 更新已有记录
    db.prepare(
      "UPDATE file_entries SET is_directory = 0, extension = ?, size_bytes = ?, is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?",
    ).run(extension, size, now, existing.id);
    return { entryId: existing.id, isNew: false };
  }

  // 创建新记录（不生成 index_suffix）
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 0, ?, NULL, ?, ?, NULL, 0, ?, ?)",
  ).run(id, libraryId, parentId, fileName, extension, size, now, now);
  return { entryId: id, isNew: true };
};

/**
 * 标记不存在的文件为已删除
 * 按 original_name 匹配
 */
const markDeletedEntries = (libraryId: number, parentId: string | null, existingNames: Set<string>): number => {
  const rows = db
    .prepare("SELECT id, original_name FROM file_entries WHERE library_id = ? AND parent_id IS ? AND is_deleted = 0")
    .all(libraryId, parentId) as { id: string; original_name: string }[];

  if (rows.length === 0) return 0;

  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE file_entries SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ? AND is_deleted = 0",
  );

  let deletedCount = 0;
  for (const row of rows) {
    // 如果原始名称不在当前扫描到的集合中，标记为删除
    if (!existingNames.has(row.original_name)) {
      stmt.run(now, now, row.id);
      deletedCount++;
    }
  }
  return deletedCount;
};

// ============================================================================
// 缩略图路径辅助
// ============================================================================

// 根据文件扩展名获取对应的缩略图后缀
const getThumbnailExt = (ext: string | null): string => {
  if (!ext) return THUMBNAIL_EXT_IMAGE;
  const lower = ext.toLowerCase();
  if (VIDEO_EXTS.has(lower)) return THUMBNAIL_EXT_VIDEO;
  return THUMBNAIL_EXT_IMAGE;
};

const getThumbnailPath = (rootPath: string, entryId: string, ext: string | null): string => {
  const thumbExt = getThumbnailExt(ext);
  return path.join(rootPath, INTERNAL_META_DIR, THUMBNAILS_DIR_NAME, `${entryId}${thumbExt}`);
};

const thumbnailExists = (rootPath: string, entryId: string, ext: string | null): boolean => {
  const thumbPath = getThumbnailPath(rootPath, entryId, ext);
  if (!fs.existsSync(thumbPath)) return false;
  // 如果缩略图小于 1KB，可能生成失败，视为不存在
  const stat = fs.statSync(thumbPath);
  return stat.size > 1024;
};

// ============================================================================
// 索引扫描核心逻辑
// ============================================================================

interface ScanResult {
  totalFiles: number;
  totalDirs: number;
  newFiles: number;
  deletedEntries: number;
  // 需要生成缩略图的条目列表
  thumbnailQueue: Array<{ entryId: string; extension: string }>;
}

/**
 * 递归扫描目录，收集文件信息（非侵入式：不修改物理文件名）
 */
const scanDirectory = (
  libraryId: number,
  rootPath: string,
  dirPath: string,
  parentEntryId: string | null,
  result: ScanResult,
  onProgress?: (current: number, label: string) => void,
): void => {
  if (!fs.existsSync(dirPath)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error(`无法读取目录 ${dirPath}:`, err);
    return;
  }

  // 收集当前目录下所有已处理的文件名（用于标记删除）
  const existingNames = new Set<string>();

  for (const entry of entries) {
    // 跳过内部配置目录
    if (entry.name === INTERNAL_META_DIR && dirPath === rootPath) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const entryId = processDirectoryEntry(
        libraryId,
        parentEntryId,
        entry.name,
      );

      // 记录目录名
      existingNames.add(entry.name);
      result.totalDirs++;

      // 递归扫描子目录
      scanDirectory(libraryId, rootPath, fullPath, entryId, result, onProgress);
    } else if (entry.isFile()) {
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue; // 无法读取文件，跳过
      }

      const { entryId, isNew } = processFileEntry(
        libraryId,
        parentEntryId,
        entry.name,
        stat.size,
      );

      // 记录文件名
      existingNames.add(entry.name);
      result.totalFiles++;
      if (isNew) result.newFiles++;

      // 检查是否需要生成缩略图
      const extension = path.extname(entry.name).toLowerCase().replace(/^\./, "") || null;
      const category = getFileCategory(extension);
      if (needsThumbnail(category) && !thumbnailExists(rootPath, entryId, extension)) {
        result.thumbnailQueue.push({ entryId, extension: extension! });
      }

      // 更新进度
      if (onProgress && result.totalFiles % 100 === 0) {
        onProgress(result.totalFiles, "扫描文件");
      }
    }
  }

  // 标记已删除的条目（按原始名称匹配）
  result.deletedEntries += markDeletedEntries(libraryId, parentEntryId, existingNames);
};

// ============================================================================
// 缩略图批量生成（同步执行，作为索引任务的一部分）
// ============================================================================

// 导入缩略图生成函数
import { generateThumbnailForEntry } from "../fileContent/thumbnailTasks.ts";

const processThumbnailQueue = async (
  queue: Array<{ entryId: string; extension: string }>,
  taskId: number,
  onProgress: (current: number, total: number) => void,
): Promise<{ success: number; failed: number }> => {
  const total = queue.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (!item) continue;
    const { entryId } = item;
    try {
      await generateThumbnailForEntry(entryId);
      success++;
    } catch (err) {
      console.error(`生成缩略图失败 [${entryId}]:`, err);
      failed++;
    }

    // 每处理 10 个或最后一个时更新进度
    if ((i + 1) % 10 === 0 || i === queue.length - 1) {
      onProgress(i + 1, total);
    }
  }

  return { success, failed };
};

// ============================================================================
// 全库索引任务处理
// ============================================================================

export const handleIndexLibraryTask = async (task: TaskRecord) => {
  const payload = task.payload as { libraryId?: number; forceReindex?: boolean };
  const libraryId = payload.libraryId;
  const forceReindex = payload.forceReindex === true;

  if (!libraryId || typeof libraryId !== "number") {
    throw new Error("索引任务缺少合法的文件库 ID");
  }

  const rootPath = getLibraryRoot(libraryId);

  // 强制索引模式：先标记所有现有索引为已删除，并清理转码文件
  if (forceReindex) {
    updateTaskStatus({
      id: task.id,
      status: "RUNNING",
      progress: 0,
      detailProgress: { current: 0, total: 0, label: "清理旧索引..." },
    });

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE file_entries SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE library_id = ? AND is_deleted = 0",
    ).run(now, now, libraryId);

    // 清理该文件库的所有转码文件
    cleanupTranscodesForLibrary(libraryId);
  }

  // 阶段 1：扫描文件系统
  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: forceReindex ? 5 : 0,
    detailProgress: { current: 0, total: 0, label: "扫描文件系统" },
  });

  const result: ScanResult = {
    totalFiles: 0,
    totalDirs: 0,
    newFiles: 0,
    deletedEntries: 0,
    thumbnailQueue: [],
  };

  scanDirectory(libraryId, rootPath, rootPath, null, result, (current, label) => {
    updateTaskDetailProgress(task.id, { current, total: 0, label });
  });

  // 扫描完成，更新进度
  const scanProgress: DetailProgress = {
    current: result.totalFiles,
    total: result.totalFiles,
    label: `扫描完成: ${result.totalFiles} 文件, ${result.totalDirs} 目录, ${result.newFiles} 新增, ${result.deletedEntries} 删除`,
  };
  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: result.thumbnailQueue.length > 0 ? 30 : 90,
    detailProgress: scanProgress,
  });

  // 阶段 2：生成缩略图（如果有需要）
  if (result.thumbnailQueue.length > 0) {
    updateTaskStatus({
      id: task.id,
      status: "RUNNING",
      progress: 30,
      detailProgress: {
        current: 0,
        total: result.thumbnailQueue.length,
        label: "生成缩略图",
      },
    });

    const thumbResult = await processThumbnailQueue(
      result.thumbnailQueue,
      task.id,
      (current, total) => {
        const overallProgress = 30 + Math.round((current / total) * 60);
        updateTaskStatus({
          id: task.id,
          status: "RUNNING",
          progress: overallProgress,
          detailProgress: { current, total, label: "生成缩略图" },
        });
      },
    );

    // 最终进度
    updateTaskStatus({
      id: task.id,
      status: "RUNNING",
      progress: 85,
      detailProgress: {
        current: result.thumbnailQueue.length,
        total: result.thumbnailQueue.length,
        label: `缩略图: ${thumbResult.success} 成功, ${thumbResult.failed} 失败`,
      },
    });
  }

  // 阶段 3：重建 FTS5 全文搜索索引
  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: result.thumbnailQueue.length > 0 ? 85 : 90,
    detailProgress: { current: 0, total: 0, label: "重建搜索索引..." },
  });

  const ftsIndexed = rebuildFtsIndexForLibrary(libraryId, (current, total) => {
    const baseProgress = result.thumbnailQueue.length > 0 ? 85 : 90;
    const ftsProgress = Math.round((current / total) * 10);
    updateTaskStatus({
      id: task.id,
      status: "RUNNING",
      progress: baseProgress + ftsProgress,
      detailProgress: { current, total, label: "重建搜索索引" },
    });
  });

  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: 98,
    detailProgress: {
      current: ftsIndexed,
      total: ftsIndexed,
      label: `搜索索引: ${ftsIndexed} 条`,
    },
  });

  // 更新文件库的最后扫描时间
  const now = new Date().toISOString();
  db.prepare("UPDATE file_libraries SET last_scanned_at = ?, updated_at = ? WHERE id = ?").run(now, now, libraryId);
};

// ============================================================================
// 单路径索引任务处理
// ============================================================================

export const handleIndexSingleTask = async (task: TaskRecord) => {
  const payload = task.payload as { libraryId?: number; relativePath?: string };
  const libraryId = payload.libraryId;
  const relativePath = payload.relativePath;

  if (!libraryId || typeof libraryId !== "number") {
    throw new Error("单路径索引任务缺少合法的文件库 ID");
  }

  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("单路径索引任务缺少合法的相对路径");
  }

  const rootPath = getLibraryRoot(libraryId);
  const targetPath = path.resolve(rootPath, relativePath);

  // 防止越界
  if (!targetPath.startsWith(path.resolve(rootPath))) {
    throw new Error("索引路径越界，不在文件库目录下");
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error("目标路径不存在");
  }

  const stat = fs.statSync(targetPath);
  const result: ScanResult = {
    totalFiles: 0,
    totalDirs: 0,
    newFiles: 0,
    deletedEntries: 0,
    thumbnailQueue: [],
  };

  if (stat.isDirectory()) {
    // 找到或创建目录的父级 entry
    const segments = relativePath.split(/[/\\]/).filter(Boolean);
    let parentId: string | null = null;

    // 逐级确保父目录存在
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (seg) {
        parentId = processDirectoryEntry(libraryId, parentId, seg);
      }
    }

    const dirName = segments[segments.length - 1] || path.basename(targetPath);
    const dirEntryId = processDirectoryEntry(libraryId, parentId, dirName);

    scanDirectory(libraryId, rootPath, targetPath, dirEntryId, result);
  } else if (stat.isFile()) {
    const baseName = path.basename(targetPath);
    const { entryId, isNew } = processFileEntry(libraryId, null, baseName, stat.size);

    result.totalFiles = 1;
    if (isNew) result.newFiles = 1;

    const extension = path.extname(baseName).toLowerCase().replace(/^\./, "") || null;
    const category = getFileCategory(extension);
    if (needsThumbnail(category) && !thumbnailExists(rootPath, entryId, extension)) {
      result.thumbnailQueue.push({ entryId, extension: extension! });
    }
  }

  // 处理缩略图
  if (result.thumbnailQueue.length > 0) {
    await processThumbnailQueue(result.thumbnailQueue, task.id, () => {});
  }

  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: 90,
    detailProgress: {
      current: result.totalFiles,
      total: result.totalFiles,
      label: `索引完成: ${result.totalFiles} 文件`,
    },
  });
};

// ============================================================================
// 注册任务处理器
// ============================================================================

export const registerFileIndexTaskHandlers = () => {
  registerTaskHandler(TASK_TYPE_FILE_INDEX_LIBRARY, handleIndexLibraryTask);
  registerTaskHandler(TASK_TYPE_FILE_INDEX_SINGLE, handleIndexSingleTask);
};

// 导出缩略图后缀常量供其他模块使用
export { THUMBNAIL_EXT_VIDEO, THUMBNAIL_EXT_IMAGE, INTERNAL_META_DIR, THUMBNAILS_DIR_NAME };
