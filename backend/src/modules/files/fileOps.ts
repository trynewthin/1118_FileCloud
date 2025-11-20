import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../../core/db/index.ts";
import {
  type FileEntry,
  getEntryById,
  getEntryByIdIncludingDeleted,
  buildRelativePathForEntry,
} from "./service.ts";

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

// 将指定条目移动到回收站（软删除）
export const moveEntryToTrash = (entryId: string): void => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const activePath = getActivePathForEntry(entry, rootPath);
  const trashPath = getTrashPathForEntry(entry, rootPath);

  const trashDir = path.dirname(trashPath);
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }

  if (fs.existsSync(activePath)) {
    fs.renameSync(activePath, trashPath);
  }

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE file_entries SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?",
  ).run(now, now, entry.id);
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

  const activeDir = path.dirname(activePath);
  if (!fs.existsSync(activeDir)) {
    fs.mkdirSync(activeDir, { recursive: true });
  }

  if (fs.existsSync(trashPath)) {
    fs.renameSync(trashPath, activePath);
  }

  const now = new Date().toISOString();

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

// 重命名条目（仅作用于未删除条目）
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
  const newPath = path.join(path.dirname(oldPath), trimmed);

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

// 移动条目到新的父目录（仅作用于未删除条目）
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

  const newPath = path.join(targetDirPath, entry.original_name);

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

// 复制条目到新的父目录，目前仅支持文件复制
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

  const baseName = newName && newName.trim().length > 0 ? newName.trim() : entry.original_name;
  const destPath = path.join(targetDirPath, baseName);

  if (fs.existsSync(destPath)) {
    throw new Error("目标位置已存在同名文件");
  }

  fs.copyFileSync(sourcePath, destPath);

  const stat = fs.statSync(destPath);
  const extension = path.extname(baseName).toLowerCase().replace(/^\./, "") || null;
  const now = new Date().toISOString();
  const newId = crypto.randomUUID();

  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?, ?, NULL, 0, ?, ?)",
  ).run(newId, entry.library_id, targetParentId, baseName, extension, stat.size, now, now);

  return newId;
};
