import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../../core/db/index.ts";
import {
  type FileEntry,
  getEntryById,
  getEntryByIdIncludingDeleted,
  buildRelativePathForEntry,
  getPhysicalName,
} from "./service.ts";
import { generateIndexSuffix, buildPhysicalName } from "./indexSuffix.ts";

// 内部配置目录与回收站目录名称
const INTERNAL_META_DIR = ".filecloud_meta";
const TRASH_DIR_NAME = "trash";

interface LibraryRow {
  id: number;
  root_path: string;
  is_enabled: number;
}

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

// 计算条目在活动区的真实路径
const getActivePathForEntry = (entry: FileEntry, libraryRootPath: string): string => {
  const relative = buildRelativePathForEntry(entry);
  return path.join(libraryRootPath, relative);
};

// 计算条目在回收站中的真实路径
const getTrashPathForEntry = (entry: FileEntry, libraryRootPath: string): string => {
  const relative = buildRelativePathForEntry(entry);
  return path.join(libraryRootPath, INTERNAL_META_DIR, TRASH_DIR_NAME, relative);
};

// 递归获取所有子条目 ID（包括嵌套的子目录）
const getAllDescendantIds = (parentId: string): string[] => {
  const children = db
    .prepare("SELECT id, is_directory FROM file_entries WHERE parent_id = ? AND is_deleted = 0")
    .all(parentId) as { id: string; is_directory: number }[];

  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    if (child.is_directory) {
      ids.push(...getAllDescendantIds(child.id));
    }
  }
  return ids;
};

// 将指定条目移动到回收站（软删除）
export const moveEntryToTrash = (entryId: string): void => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const activePath = getActivePathForEntry(entry, rootPath);
  const trashPath = getTrashPathForEntry(entry, rootPath);

  // 先获取所有子条目 ID（在移动文件之前，因为移动后可能影响查询）
  let descendantIds: string[] = [];
  if (entry.is_directory) {
    descendantIds = getAllDescendantIds(entry.id);
  }

  const trashDir = path.dirname(trashPath);
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }

  // 如果目标路径已存在，先删除（可能是之前删除失败留下的残留）
  if (fs.existsSync(trashPath)) {
    fs.rmSync(trashPath, { recursive: true, force: true });
  }

  if (fs.existsSync(activePath)) {
    // 使用 cpSync + rmSync 代替 renameSync，避免跨设备移动问题
    if (entry.is_directory) {
      fs.cpSync(activePath, trashPath, { recursive: true });
      fs.rmSync(activePath, { recursive: true, force: true });
    } else {
      fs.renameSync(activePath, trashPath);
    }
  }

  const now = new Date().toISOString();

  // 如果是目录，需要同时标记所有子条目为已删除
  if (descendantIds.length > 0) {
    // 批量更新所有子条目
    const placeholders = descendantIds.map(() => "?").join(",");
    db.prepare(
      `UPDATE file_entries SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
    ).run(now, now, ...descendantIds);
  }

  // 更新当前条目
  db.prepare(
    "UPDATE file_entries SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?",
  ).run(now, now, entry.id);
};

// 递归获取所有已删除的子条目 ID
const getAllDeletedDescendantIds = (parentId: string): string[] => {
  const children = db
    .prepare("SELECT id, is_directory FROM file_entries WHERE parent_id = ? AND is_deleted = 1")
    .all(parentId) as { id: string; is_directory: number }[];

  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    if (child.is_directory) {
      ids.push(...getAllDeletedDescendantIds(child.id));
    }
  }
  return ids;
};

// 从回收站还原指定条目
export const restoreEntryFromTrash = (entryId: string): void => {
  const entry = getEntryByIdIncludingDeleted(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在");
  }

  if (!entry.is_deleted) {
    throw new Error("文件或目录未被删除，无需还原");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const activePath = getActivePathForEntry(entry, rootPath);
  const trashPath = getTrashPathForEntry(entry, rootPath);

  // 先获取所有已删除的子条目 ID
  let descendantIds: string[] = [];
  if (entry.is_directory) {
    descendantIds = getAllDeletedDescendantIds(entry.id);
  }

  const activeDir = path.dirname(activePath);
  if (!fs.existsSync(activeDir)) {
    fs.mkdirSync(activeDir, { recursive: true });
  }

  // 如果目标路径已存在，先删除
  if (fs.existsSync(activePath)) {
    fs.rmSync(activePath, { recursive: true, force: true });
  }

  if (fs.existsSync(trashPath)) {
    // 使用 cpSync + rmSync 代替 renameSync，避免跨设备移动问题
    if (entry.is_directory) {
      fs.cpSync(trashPath, activePath, { recursive: true });
      fs.rmSync(trashPath, { recursive: true, force: true });
    } else {
      fs.renameSync(trashPath, activePath);
    }
  }

  const now = new Date().toISOString();

  // 如果是目录，需要同时还原所有子条目
  if (descendantIds.length > 0) {
    const placeholders = descendantIds.map(() => "?").join(",");
    db.prepare(
      `UPDATE file_entries SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id IN (${placeholders})`,
    ).run(now, ...descendantIds);
  }

  // 更新当前条目
  db.prepare(
    "UPDATE file_entries SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?",
  ).run(now, entry.id);
};

// 彻底删除：移除回收站中的物理文件/目录，保留数据库中的删除记录
export const permanentlyDeleteEntry = (entryId: string): void => {
  const entry = getEntryByIdIncludingDeleted(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在");
  }

  if (!entry.is_deleted) {
    throw new Error("仅支持对已删除的条目执行彻底删除");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const trashPath = getTrashPathForEntry(entry, rootPath);

  if (fs.existsSync(trashPath)) {
    const stat = fs.statSync(trashPath);
    if (stat.isDirectory()) {
      fs.rmSync(trashPath, { recursive: true, force: true });
    } else {
      fs.rmSync(trashPath, { force: true });
    }
  }

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE file_entries SET updated_at = ? WHERE id = ?",
  ).run(now, entry.id);
};

/**
 * 重命名条目（仅作用于未删除条目）
 * 新逻辑：只修改 original_name，物理文件名的后缀部分保持不变
 * 例如：用户将 "文件.mp4" 重命名为 "新文件.mp4"
 *       物理文件从 "文件[abc123].mp4" 变为 "新文件[abc123].mp4"
 */
export const renameEntry = (entryId: string, newName: string): void => {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("新名称不能为空");
  }

  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const oldPath = getActivePathForEntry(entry, rootPath);

  // 构建新的物理文件名（保持原有后缀）
  let newPhysicalName: string;
  if (entry.index_suffix) {
    newPhysicalName = buildPhysicalName(trimmed, entry.index_suffix);
  } else {
    // 旧数据没有后缀，直接使用新名称
    newPhysicalName = trimmed;
  }

  const newPath = path.join(path.dirname(oldPath), newPhysicalName);

  if (fs.existsSync(newPath) && newPath !== oldPath) {
    throw new Error("目标名称已存在");
  }

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }

  const now = new Date().toISOString();
  const extension = path.extname(trimmed).toLowerCase().replace(/^\./, "") || null;

  db.prepare(
    "UPDATE file_entries SET original_name = ?, extension = ?, updated_at = ? WHERE id = ?",
  ).run(trimmed, extension, now, entry.id);
};

/**
 * 移动条目到新的父目录（仅作用于未删除条目）
 * 物理文件名（带后缀）跟着移动，数据库只更新 parent_id
 */
export const moveEntry = (entryId: string, targetParentId: string | null): void => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  let targetParent: FileEntry | null = null;
  if (targetParentId) {
    targetParent = getEntryById(targetParentId);
    if (!targetParent) {
      throw new Error("目标父目录不存在");
    }
    if (!targetParent.is_directory) {
      throw new Error("目标父条目不是目录");
    }
    if (targetParent.library_id !== entry.library_id) {
      throw new Error("不能跨文件库移动条目");
    }
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const oldPath = getActivePathForEntry(entry, rootPath);

  const targetDirPath = targetParent
    ? getActivePathForEntry(targetParent, rootPath)
    : rootPath;

  if (!fs.existsSync(targetDirPath)) {
    fs.mkdirSync(targetDirPath, { recursive: true });
  }

  // 使用物理文件名（带后缀）
  const physicalName = getPhysicalName(entry);
  const newPath = path.join(targetDirPath, physicalName);

  if (fs.existsSync(newPath) && newPath !== oldPath) {
    throw new Error("目标位置已存在同名条目");
  }

  if (fs.existsSync(oldPath) && oldPath !== newPath) {
    fs.renameSync(oldPath, newPath);
  }

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE file_entries SET parent_id = ?, updated_at = ? WHERE id = ?",
  ).run(targetParentId, now, entry.id);
};

/**
 * 复制条目到新的父目录，目前仅支持文件复制
 * 新逻辑：为复制的文件生成新的后缀
 */
export const copyEntry = (
  entryId: string,
  targetParentId: string | null,
  newName?: string,
): string => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  if (entry.is_directory) {
    throw new Error("暂不支持目录复制");
  }

  let targetParent: FileEntry | null = null;
  if (targetParentId) {
    targetParent = getEntryById(targetParentId);
    if (!targetParent) {
      throw new Error("目标父目录不存在");
    }
    if (!targetParent.is_directory) {
      throw new Error("目标父条目不是目录");
    }
    if (targetParent.library_id !== entry.library_id) {
      throw new Error("不能跨文件库复制条目");
    }
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const sourcePath = getActivePathForEntry(entry, rootPath);

  const targetDirPath = targetParent
    ? getActivePathForEntry(targetParent, rootPath)
    : rootPath;

  if (!fs.existsSync(targetDirPath)) {
    fs.mkdirSync(targetDirPath, { recursive: true });
  }

  // 用户指定的名称或原始名称（不含后缀）
  const originalName = newName && newName.trim().length > 0 ? newName.trim() : entry.original_name;

  // 为新文件生成新后缀
  const newSuffix = generateIndexSuffix();
  const physicalName = buildPhysicalName(originalName, newSuffix);
  const destPath = path.join(targetDirPath, physicalName);

  if (fs.existsSync(destPath)) {
    throw new Error("目标位置已存在同名文件");
  }

  fs.copyFileSync(sourcePath, destPath);

  const stat = fs.statSync(destPath);
  const extension = path.extname(originalName).toLowerCase().replace(/^\./, "") || null;
  const now = new Date().toISOString();
  const newId = crypto.randomUUID();

  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?, ?, ?, NULL, 0, ?, ?)",
  ).run(newId, entry.library_id, targetParentId, originalName, newSuffix, extension, stat.size, now, now);

  return newId;
};
