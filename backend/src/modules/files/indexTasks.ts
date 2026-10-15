import fs from "node:fs";
import { withLibraryMutation } from "./mutationLock.ts";
import { getEntryById, resolveRealPathForEntry } from "./service.ts";
import { pathExists } from "../../core/fs.ts";
import path from "node:path";
import crypto from "node:crypto";
import { assertValidPathSegment, resolvePathWithinLibrary } from "../../core/config/pathSecurity.ts";
import { db } from "../../core/db/index.ts";
import type { TaskContext } from "../../core/tasks/types.ts";
import { rebuildFtsIndexForLibrary } from "./ftsService.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";
import { cleanupTranscodesForLibrary } from "../fileContent/index.ts";

// ============================================================================
// 任务类型常量
// ============================================================================
export {
  TASK_TYPE_FILE_INDEX_LIBRARY,
  TASK_TYPE_FILE_INDEX_SINGLE,
} from "./taskTypes.ts";

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

const getThumbnailPath = async (rootPath: string, entryId: string, ext: string | null): Promise<string> => {
  const thumbExt = getThumbnailExt(ext);
  assertValidPathSegment(entryId);
  return (await resolvePathWithinLibrary(rootPath, path.join(INTERNAL_META_DIR, THUMBNAILS_DIR_NAME, `${entryId}${thumbExt}`)));
};

const thumbnailExists = async (rootPath: string, entryId: string, ext: string | null): Promise<boolean> => {
  const thumbPath = (await getThumbnailPath(rootPath, entryId, ext));
  if (!(await pathExists(thumbPath))) return false;
  // 如果缩略图小于 1KB，可能生成失败，视为不存在
  const stat = (await fs.promises.stat(thumbPath));
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
const scanDirectory = async (
  libraryId: number,
  rootPath: string,
  dirPath: string,
  parentEntryId: string | null,
  result: ScanResult,
  onProgress?: (current: number, label: string) => void,
): Promise<void> => {
  dirPath = (await resolvePathWithinLibrary(rootPath, path.relative(rootPath, dirPath)));
  if (!(await pathExists(dirPath))) return;

  let entries: fs.Dirent[];
  try {
    entries = (await fs.promises.readdir(dirPath, { withFileTypes: true }));
  } catch (err) {
    console.error(`无法读取目录 ${dirPath}:`, err);
    return;
  }

  // 收集当前目录下所有已处理的文件名（用于标记删除）
  const existingNames = new Set<string>();

  for (const entry of entries) {
    // 跳过内部配置目录
    if (entry.name === INTERNAL_META_DIR && dirPath === rootPath) continue;

    // Never follow directory or file links during a scan. Validate each actual
    // I/O path as well, including a directory replaced after readdir.
    if (entry.isSymbolicLink()) continue;
    let fullPath: string;
    let stat: fs.Stats;
    try {
      assertValidPathSegment(entry.name);
      fullPath = (await resolvePathWithinLibrary(rootPath, path.relative(rootPath, path.join(dirPath, entry.name))));
      stat = (await fs.promises.lstat(fullPath));
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      const entryId = processDirectoryEntry(
        libraryId,
        parentEntryId,
        entry.name,
      );

      // 记录目录名
      existingNames.add(entry.name);
      result.totalDirs++;

      // 递归扫描子目录
      (await scanDirectory(libraryId, rootPath, fullPath, entryId, result, onProgress));
    } else if (stat.isFile()) {
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
      if (needsThumbnail(category) && !(await thumbnailExists(rootPath, entryId, extension))) {
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
import { generateThumbnailForEntry } from "../fileContent/index.ts";

const processThumbnailQueue = async (
  queue: Array<{ entryId: string; extension: string }>,
  ctx: TaskContext,
  onProgress: (current: number, total: number) => void,
): Promise<{ success: number; failed: number }> => {
  const total = queue.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    // 检查是否被取消
    if (ctx.isCancelled()) {
      ctx.log.warn("任务已取消，停止生成缩略图");
      break;
    }

    const item = queue[i];
    if (!item) continue;
    const { entryId } = item;
    try {
      await generateThumbnailForEntry(entryId);
      success++;
    } catch (err) {
      ctx.log.error(`生成缩略图失败 [${entryId}]`, err);
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

export const handleIndexLibraryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, updateProgress, updateDetailProgress, log } = ctx;
  const payload = task.payload as { libraryId?: number; forceReindex?: boolean };
  const libraryId = payload.libraryId;
  const forceReindex = payload.forceReindex === true;

  if (typeof libraryId !== "number" || !Number.isSafeInteger(libraryId) || libraryId <= 0) {
    throw new Error("索引任务缺少合法的文件库 ID");
  }

  return withLibraryMutation(libraryId, async () => {
  const rootPath = (await getLibraryRoot(libraryId));
  // Fail before force-reindex changes the database if the root is unavailable.
  (await fs.promises.readdir(rootPath));
  log.info(`开始索引文件库 #${libraryId}, 路径: ${rootPath}, 强制重建: ${forceReindex}`);

  // 强制索引模式：先标记所有现有索引为已删除，并清理转码文件
  if (forceReindex) {
    updateDetailProgress(0, 0, "清理旧索引...");

    const now = new Date().toISOString();
    db.prepare(
      "UPDATE file_entries SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE library_id = ? AND is_deleted = 0",
    ).run(now, now, libraryId);

    // 清理该文件库的所有转码文件
    (await cleanupTranscodesForLibrary(libraryId));
  }

  // 阶段 1：扫描文件系统
  updateProgress(forceReindex ? 5 : 0, "扫描文件系统");

  const result: ScanResult = {
    totalFiles: 0,
    totalDirs: 0,
    newFiles: 0,
    deletedEntries: 0,
    thumbnailQueue: [],
  };

  (await scanDirectory(libraryId, rootPath, rootPath, null, result, (current, label) => {
    updateDetailProgress(current, 0, label);
  }));

  // 扫描完成
  log.info(`扫描完成: ${result.totalFiles} 文件, ${result.totalDirs} 目录, ${result.newFiles} 新增`);
  updateProgress(
    result.thumbnailQueue.length > 0 ? 30 : 90,
    `扫描完成: ${result.totalFiles} 文件, ${result.newFiles} 新增`
  );

  // 阶段 2：生成缩略图（如果有需要）
  if (result.thumbnailQueue.length > 0) {
    updateDetailProgress(0, result.thumbnailQueue.length, "生成缩略图");

    const thumbResult = await processThumbnailQueue(
      result.thumbnailQueue,
      ctx,
      (current, total) => {
        const overallProgress = 30 + Math.round((current / total) * 60);
        updateProgress(overallProgress, "生成缩略图");
        updateDetailProgress(current, total, "生成缩略图");
      },
    );

    log.info(`缩略图生成完成: ${thumbResult.success} 成功, ${thumbResult.failed} 失败`);
    updateProgress(85, `缩略图: ${thumbResult.success} 成功, ${thumbResult.failed} 失败`);
  }

  // 阶段 3：重建 FTS5 全文搜索索引
  updateProgress(result.thumbnailQueue.length > 0 ? 85 : 90, "重建搜索索引...");

  const ftsIndexed = rebuildFtsIndexForLibrary(libraryId, (current, total) => {
    const baseProgress = result.thumbnailQueue.length > 0 ? 85 : 90;
    const ftsProgress = Math.round((current / total) * 10);
    updateProgress(baseProgress + ftsProgress, "重建搜索索引");
    updateDetailProgress(current, total, "重建搜索索引");
  });

  log.info(`搜索索引重建完成: ${ftsIndexed} 条`);
  updateProgress(98, `搜索索引: ${ftsIndexed} 条`);

  // 更新文件库的最后扫描时间
  const now = new Date().toISOString();
  db.prepare("UPDATE file_libraries SET last_scanned_at = ?, updated_at = ? WHERE id = ?").run(now, now, libraryId);
  });
};

// ============================================================================
// 单路径索引任务处理
// ============================================================================

export const handleIndexSingleTask = async (ctx: TaskContext): Promise<void> => {
  const { task, updateProgress, log } = ctx;
  const payload = task.payload as { libraryId?: number; relativePath?: string; parentEntryId?: unknown };
  const libraryId = payload.libraryId;
  const relativePath = payload.relativePath;

  if (typeof libraryId !== "number" || !Number.isSafeInteger(libraryId) || libraryId <= 0) {
    throw new Error("单路径索引任务缺少合法的文件库 ID");
  }

  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("单路径索引任务缺少合法的相对路径");
  }

  return withLibraryMutation(libraryId, async () => {
  const rootPath = (await getLibraryRoot(libraryId));
  let targetPath: string;
  if (payload.parentEntryId !== undefined) {
    // Upload destinations are stable entry IDs: a queued task follows a renamed
    // parent, and never falls back to an old path after deletion/reassignment.
    const parent = typeof payload.parentEntryId === "string" ? getEntryById(payload.parentEntryId) : null;
    if (!parent || !parent.is_directory || parent.library_id !== libraryId) throw new Error("上传目标目录不存在或不属于当前文件库");
    targetPath = await resolveRealPathForEntry(parent, rootPath);
  } else {
    targetPath = await resolvePathWithinLibrary(rootPath, relativePath);
  }
  const normalizedRelativePath = path.relative(rootPath, targetPath);
  const segments = normalizedRelativePath.split(path.sep).filter(Boolean);
  if (segments[0] === INTERNAL_META_DIR) {
    throw new Error("不能索引文件库内部元数据");
  }
  for (const segment of segments) assertValidPathSegment(segment);

  if (!(await pathExists(targetPath))) {
    throw new Error("目标路径不存在");
  }

  log.info(`开始索引路径: ${relativePath}`);

  const stat = (await fs.promises.lstat(targetPath));
  if (!stat.isFile() && !stat.isDirectory()) throw new Error("目标必须是文件或文件夹");
  const result: ScanResult = {
    totalFiles: 0,
    totalDirs: 0,
    newFiles: 0,
    deletedEntries: 0,
    thumbnailQueue: [],
  };

  // Keep the same normalized parent chain for files and directories. Using
  // the raw path (including '..') would corrupt the stored hierarchy.
  let parentId: string | null = null;
  for (const segment of segments.slice(0, -1)) {
    parentId = processDirectoryEntry(libraryId, parentId, segment);
  }

  if (stat.isDirectory()) {
    const dirEntryId = segments.length === 0 ? null : processDirectoryEntry(
      libraryId, parentId, segments[segments.length - 1]!,
    );
    (await scanDirectory(libraryId, rootPath, targetPath, dirEntryId, result));
  } else if (stat.isFile()) {
    const baseName = path.basename(targetPath);
    const { entryId, isNew } = processFileEntry(libraryId, parentId, baseName, stat.size);

    result.totalFiles = 1;
    if (isNew) result.newFiles = 1;

    const extension = path.extname(baseName).toLowerCase().replace(/^\./, "") || null;
    const category = getFileCategory(extension);
    if (needsThumbnail(category) && !(await thumbnailExists(rootPath, entryId, extension))) {
      result.thumbnailQueue.push({ entryId, extension: extension! });
    }
  }

  // 处理缩略图
  if (result.thumbnailQueue.length > 0) {
    await processThumbnailQueue(result.thumbnailQueue, ctx, () => {});
  }

  log.info(`索引完成: ${result.totalFiles} 文件`);
  updateProgress(90, `索引完成: ${result.totalFiles} 文件`);
  });
};

// 导出缩略图后缀常量供其他模块使用
export { THUMBNAIL_EXT_VIDEO, THUMBNAIL_EXT_IMAGE, INTERNAL_META_DIR, THUMBNAILS_DIR_NAME };
