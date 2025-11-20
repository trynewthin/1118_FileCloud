import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../../core/db/index.ts";
import { registerTaskHandler } from "../../core/tasks/executor.ts";
import type { TaskRecord } from "../tasks/service.ts";
import { updateTaskStatus } from "../tasks/service.ts";
import { createTask } from "../tasks/service.ts";
import { TASK_TYPE_FILE_GENERATE_THUMBNAIL } from "../fileContent/thumbnailTasks.ts";

// 索引相关任务类型常量
export const TASK_TYPE_FILE_INDEX_LIBRARY = "FILE_INDEX_LIBRARY";
export const TASK_TYPE_FILE_INDEX_SINGLE = "FILE_INDEX_SINGLE";

// 内部配置目录名称，索引时会跳过
const INTERNAL_META_DIR = ".filecloud_meta";
const THUMBNAILS_DIR_NAME = "thumbnails";

// 支持生成缩略图的扩展名（不带点，小写）
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "ogv", "mov", "mkv", "avi"]);

const isSupportedForThumbnail = (ext: string | null): boolean => {
  if (!ext) return false;
  const lower = ext.toLowerCase();
  return IMAGE_EXTS.has(lower) || VIDEO_EXTS.has(lower);
};

// 查询文件库的根路径
const getLibraryRoot = (libraryId: number) => {
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

// 在数据库中根据父节点和名称查找已存在的索引记录
const findEntryId = (
  libraryId: number,
  parentId: string | null,
  name: string,
): string | null => {
  const row = db
    .prepare(
      "SELECT id FROM file_entries WHERE library_id = ? AND parent_id IS ? AND original_name = ? LIMIT 1",
    )
    .get(libraryId, parentId, name) as { id: string } | undefined;

  return row?.id ?? null;
};

// 确保某个路径对应的目录索引存在，返回该目录的 entry id
const ensureDirectoryEntry = (
  libraryId: number,
  parentId: string | null,
  name: string,
): string => {
  const now = new Date().toISOString();
  const existingId = findEntryId(libraryId, parentId, name);

  if (existingId) {
    db.prepare(
      "UPDATE file_entries SET is_directory = 1, is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?",
    ).run(now, existingId);
    return existingId;
  }

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 1, ?, NULL, 0, NULL, 0, ?, ?)",
  ).run(id, libraryId, parentId, name, now, now);

  return id;
};

// 确保某个路径对应的文件索引存在或更新，返回条目的 id
const upsertFileEntry = (
  libraryId: number,
  parentId: string | null,
  name: string,
  size: number,
): string => {
  const now = new Date().toISOString();
  const extension = path.extname(name).toLowerCase().replace(/^\./, "") || null;

  const existingId = findEntryId(libraryId, parentId, name);

  if (existingId) {
    db.prepare(
      "UPDATE file_entries SET is_directory = 0, size_bytes = ?, extension = ?, is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?",
    ).run(size, extension, now, existingId);
    return existingId;
  }

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?, ?, NULL, 0, ?, ?)",
  ).run(id, libraryId, parentId, name, extension, size, now, now);

  return id;
};

// 在需要时为条目创建缩略图生成任务
const maybeEnqueueThumbnailTask = (
  libraryId: number,
  rootPath: string,
  entryId: string,
  extension: string | null,
) => {
  if (!isSupportedForThumbnail(extension)) {
    return;
  }

  const thumbnailPath = path.join(
    rootPath,
    INTERNAL_META_DIR,
    THUMBNAILS_DIR_NAME,
    `${entryId}.jpg`,
  );

  if (fs.existsSync(thumbnailPath)) {
    return;
  }

  createTask({
    type: TASK_TYPE_FILE_GENERATE_THUMBNAIL,
    payload: { entryId },
  });
};

// 递归扫描指定目录并同步到索引表（不会删除已有记录，只做新增/更新）
const scanDirectoryToIndex = (
  libraryId: number,
  rootPath: string,
  dirPath: string,
  parentEntryId: string | null,
  progress: { processed: number; total?: number },
) => {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    // 跳过内部配置目录
    if (entry.name === INTERNAL_META_DIR && dirPath === rootPath) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const dirEntryId = ensureDirectoryEntry(libraryId, parentEntryId, entry.name);
      progress.processed += 1;
      scanDirectoryToIndex(
        libraryId,
        rootPath,
        fullPath,
        dirEntryId,
        progress,
      );
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      const extension = path.extname(entry.name).toLowerCase().replace(/^\./, "") || null;
      const entryId = upsertFileEntry(libraryId, parentEntryId, entry.name, stat.size);
      progress.processed += 1;
      maybeEnqueueThumbnailTask(libraryId, rootPath, entryId, extension);
    }
  }
};

// 全库索引任务处理
const handleIndexLibraryTask = async (task: TaskRecord) => {
  const payload = task.payload as { libraryId?: number };
  const libraryId = payload.libraryId;

  if (!libraryId || typeof libraryId !== "number") {
    throw new Error("索引任务缺少合法的文件库 ID");
  }

  const rootPath = getLibraryRoot(libraryId);

  const progress = { processed: 0 };

  scanDirectoryToIndex(libraryId, rootPath, rootPath, null, progress);

  // 简单按处理数量更新一下进度（这里只能给一个近似值）
  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: 90,
  });
};

// 单路径索引任务处理
const handleIndexSingleTask = async (task: TaskRecord) => {
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

  // 防止越界到文件库之外
  if (!targetPath.startsWith(path.resolve(rootPath))) {
    throw new Error("索引路径越界，不在文件库目录下");
  }

  const stat = fs.statSync(targetPath);

  const progress = { processed: 0 };

  if (stat.isDirectory()) {
    const baseName = path.basename(targetPath);
    const dirEntryId = ensureDirectoryEntry(libraryId, null, baseName);
    scanDirectoryToIndex(
      libraryId,
      rootPath,
      targetPath,
      dirEntryId,
      progress,
    );
  } else if (stat.isFile()) {
    const baseName = path.basename(targetPath);
    const extension = path.extname(baseName).toLowerCase().replace(/^\./, "") || null;
    const entryId = upsertFileEntry(libraryId, null, baseName, stat.size);
    progress.processed += 1;
    maybeEnqueueThumbnailTask(libraryId, rootPath, entryId, extension);
  }

  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: 90,
  });
};

// 注册文件索引相关任务处理器
export const registerFileIndexTaskHandlers = () => {
  registerTaskHandler(TASK_TYPE_FILE_INDEX_LIBRARY, handleIndexLibraryTask);
  registerTaskHandler(TASK_TYPE_FILE_INDEX_SINGLE, handleIndexSingleTask);
};
