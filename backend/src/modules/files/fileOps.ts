import fs from "node:fs";
import { withLibraryMutation } from "./mutationLock.ts";
import { pathExists } from "../../core/fs.ts";
import path from "node:path";
import crypto from "node:crypto";
import { resolveMutationPathWithinLibrary, assertSafeDirectoryTree, assertValidPathSegment } from "../../core/config/pathSecurity.ts";
import { db } from "../../core/db/index.ts";
import {
  type FileEntry,
  getEntryById,
  getEntryByIdIncludingDeleted,
  buildRelativePathForEntry,
  getPhysicalName,
} from "./service.ts";
// 注意：已移除 indexSuffix 导入，采用非侵入式索引策略
import { recordFileEvent, upsertFtsIndex, deleteFtsIndex } from "./ftsService.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";

// 内部配置目录与回收站目录名称
const INTERNAL_META_DIR = ".filecloud_meta";
const TRASH_DIR_NAME = "trash";

// 注意：getLibraryRoot 已统一从 core/middleware 导入

// 计算条目在活动区的真实路径
const getActivePathForEntry = async (entry: FileEntry, libraryRootPath: string): Promise<string> => {
  const relative = buildRelativePathForEntry(entry);
  return (await resolveMutationPathWithinLibrary(libraryRootPath, relative));
};

// 计算条目在回收站中的真实路径
const getTrashPathForEntry = async (entry: FileEntry, libraryRootPath: string): Promise<string> => {
  const saved = db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id = ?")
    .get(entry.id) as { relative_path: string } | null;
  // Legacy deletions remain readable; new deletions never reuse name-based slots.
  const relative = saved?.relative_path ?? path.join(INTERNAL_META_DIR, TRASH_DIR_NAME, buildRelativePathForEntry(entry));
  return (await resolveMutationPathWithinLibrary(libraryRootPath, relative));
};

const assertNoPendingTrashPayload = async (entryId: string, rootPath: string): Promise<void> => {
  const saved = db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id = ?")
    .get(entryId) as { relative_path: string } | null;
  if (saved && (await pathExists((await resolveMutationPathWithinLibrary(rootPath, saved.relative_path))))) {
    throw new Error("已有未完成的回收站操作，文件已保留，请先恢复后再重试");
  }
};

const validateName = (name: string): void => {
  assertValidPathSegment(name);
  if (name === INTERNAL_META_DIR) throw new Error("文件名称不合法");
};

// Exclusive copies prevent a restore from replacing an existing file, even if it
// appears after the initial existence check. Source data stays intact on failure.
const moveWithoutReplacing = async (source: string, target: string, directory: boolean): Promise<void> => {
  if (!(await pathExists(source))) throw new Error("源文件不存在，操作未完成");
  if (directory) {
    (await fs.promises.mkdir(target)); // exclusive reservation; EEXIST is a conflict
    try {
      (await fs.promises.cp(source, target, { recursive: true, force: false, errorOnExist: true }));
    } catch (error) {
      (await fs.promises.rm(target, { recursive: true, force: true }));
      throw error;
    }
  } else {
    try {
      // link is exclusive and avoids copying large files on one filesystem.
      await fs.promises.link(source, target);
    } catch (error: any) {
      if (!["EXDEV", "EPERM", "ENOTSUP", "EOPNOTSUPP"].includes(error?.code)) throw error;
      await fs.promises.copyFile(source, target, fs.constants.COPYFILE_EXCL);
    }
  }
  (await fs.promises.rm(source, { recursive: directory }));
};

// SQLite and filesystem moves cannot share an atomic commit. Persist recovery
// locations first, transact DB state, and compensate a failed DB update without
// ever replacing a file that appeared at the original location.
const moveAndFinalize = async (source: string, target: string, directory: boolean, finalize: () => void): Promise<void> => {
  (await moveWithoutReplacing(source, target, directory));
  try {
    db.transaction(finalize)();
  } catch (error) {
    try {
      (await moveWithoutReplacing(target, source, directory));
    } catch {
      throw new Error("数据库更新失败，文件保留在已记录的恢复位置，需要人工恢复", { cause: error });
    }
    throw error;
  }
};

// Validate the whole indexed subtree before touching disk.
const getDescendantIds = (parentId: string, deleted: boolean): string[] => {
  const parent = getEntryByIdIncludingDeleted(parentId)!;
  const seen = new Set([parentId]);
  const pending = [parentId];
  const ids: string[] = [];
  while (pending.length) {
    const children = db.prepare("SELECT id, library_id, is_directory FROM file_entries WHERE parent_id = ? AND is_deleted = ?")
      .all(pending.pop()!, Number(deleted)) as { id: string; library_id: number; is_directory: number }[];
    for (const child of children) {
      if (seen.has(child.id) || child.library_id !== parent.library_id) throw new Error("文件父级关系不合法");
      seen.add(child.id);
      ids.push(child.id);
      if (child.is_directory) pending.push(child.id);
    }
  }
  return ids;
};

// 将指定条目移动到回收站（软删除）
export const moveEntryToTrash = async (entryId: string): Promise<void> => {
  return withEntryMutation(entryId, async () => {

  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  const rootPath = (await getLibraryRoot(entry.library_id));
  const activePath = (await getActivePathForEntry(entry, rootPath));
  if (!(await pathExists(activePath))) throw new Error("源文件不存在，操作未完成");
  (await assertNoPendingTrashPayload(entry.id, rootPath));
  const trashRelative = path.join(INTERNAL_META_DIR, TRASH_DIR_NAME, crypto.randomUUID(), "payload");
  const trashPath = (await resolveMutationPathWithinLibrary(rootPath, trashRelative));

  // 先获取所有子条目 ID（在移动文件之前，因为移动后可能影响查询）
  let descendantIds: string[] = [];
  if (entry.is_directory) {
    descendantIds = getDescendantIds(entry.id, false);
  }

  const childLocations: { id: string; relative: string }[] = [];
  for (const id of descendantIds) {
    (await assertNoPendingTrashPayload(id, rootPath));
    const child = getEntryById(id)!;
    const suffix = path.relative(activePath, (await getActivePathForEntry(child, rootPath)));
    if (suffix === ".." || suffix.startsWith(`..${path.sep}`) || path.isAbsolute(suffix)) {
      throw new Error("文件父级关系不合法");
    }
    childLocations.push({ id, relative: path.join(trashRelative, suffix) });
  }

  const trashDir = path.dirname(trashPath);
  if (!(await pathExists(trashDir))) {
    (await fs.promises.mkdir(trashDir, { recursive: true }));
  }

  if (entry.is_directory) (await assertSafeDirectoryTree(rootPath, activePath, { rejectSymlinks: true }));
  const saveLocation = db.prepare("INSERT OR REPLACE INTO file_trash_locations(entry_id, relative_path) VALUES (?, ?)");
  db.transaction(() => {
    saveLocation.run(entry.id, trashRelative);
    for (const child of childLocations) saveLocation.run(child.id, child.relative);
  })();

  (await moveAndFinalize(activePath, trashPath, entry.is_directory, () => {
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

    // 记录事件并更新 FTS 索引
    for (const id of [entry.id, ...descendantIds]) {
      recordFileEvent({ libraryId: entry.library_id, fileId: id, eventType: "deleted" });
      deleteFtsIndex(id);
    }
  }));

  });
};

// 从回收站还原指定条目
export const restoreEntryFromTrash = async (entryId: string): Promise<void> => {
  return withEntryMutation(entryId, async () => {

  const entry = getEntryByIdIncludingDeleted(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在");
  }

  if (!entry.is_deleted) {
    throw new Error("文件或目录未被删除，无需还原");
  }

  const rootPath = (await getLibraryRoot(entry.library_id));
  const activePath = (await getActivePathForEntry(entry, rootPath));
  const trashPath = (await getTrashPathForEntry(entry, rootPath));

  // 先获取所有已删除的子条目 ID
  let descendantIds: string[] = [];
  if (entry.is_directory) {
    for (const id of getDescendantIds(entry.id, true)) {
      const child = getEntryByIdIncludingDeleted(id)!;
      const childTrash = (await getTrashPathForEntry(child, rootPath));
      const relative = path.relative(trashPath, childTrash);
      if ((await pathExists(childTrash)) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) descendantIds.push(id);
    }
  }

  if (entry.parent_id && getEntryByIdIncludingDeleted(entry.parent_id)?.is_deleted) {
    throw new Error("请先还原父目录");
  }

  const activeDir = path.dirname(activePath);
  if (!(await pathExists(activeDir))) {
    (await fs.promises.mkdir(activeDir, { recursive: true }));
  }

  if ((await pathExists(activePath))) throw new Error("还原位置已存在同名条目，请先重命名或移动现有条目");
  if (entry.is_directory) (await assertSafeDirectoryTree(rootPath, trashPath, { rejectSymlinks: true }));
  (await moveAndFinalize(trashPath, activePath, entry.is_directory, () => {
    for (const id of [entry.id, ...descendantIds]) {
      db.prepare("DELETE FROM file_trash_locations WHERE entry_id = ?").run(id);
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

    // 还原后重新添加到 FTS 索引
    const restoredEntry = getEntryById(entry.id);
    if (restoredEntry) {
      recordFileEvent({
        libraryId: restoredEntry.library_id,
        fileId: restoredEntry.id,
        eventType: "created",
      });
      upsertFtsIndex(restoredEntry);
    }

    // 子条目也需要重新添加到 FTS
    for (const childId of descendantIds) {
      const childEntry = getEntryById(childId);
      if (childEntry) {
        recordFileEvent({
          libraryId: childEntry.library_id,
          fileId: childEntry.id,
          eventType: "created",
        });
        upsertFtsIndex(childEntry);
      }
    }
  }));

  });
};

// 彻底删除：移除回收站中的物理文件/目录，保留数据库中的删除记录
export const permanentlyDeleteEntry = async (entryId: string): Promise<void> => {
  return withEntryMutation(entryId, async () => {

  const entry = getEntryByIdIncludingDeleted(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在");
  }

  if (!entry.is_deleted) {
    throw new Error("仅支持对已删除的条目执行彻底删除");
  }

  const rootPath = (await getLibraryRoot(entry.library_id));
  const trashPath = (await getTrashPathForEntry(entry, rootPath));

  if ((await pathExists(trashPath))) {
    const stat = (await fs.promises.stat(trashPath));
    if (stat.isDirectory()) {
      (await fs.promises.rm(trashPath, { recursive: true, force: true }));
    } else {
      (await fs.promises.rm(trashPath, { force: true }));
    }
  }

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE file_entries SET updated_at = ? WHERE id = ?",
  ).run(now, entry.id);

  });
};

/**
 * 重命名条目（仅作用于未删除条目）
 * 非侵入式索引：直接重命名物理文件
 */
export const renameEntry = async (entryId: string, newName: string): Promise<void> => {
  return withEntryMutation(entryId, async () => {

  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("新名称不能为空");
  }

  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件或目录不存在，或已被删除");
  }

  const rootPath = (await getLibraryRoot(entry.library_id));
  const oldPath = (await getActivePathForEntry(entry, rootPath));

  // 非侵入式：直接使用新名称作为物理文件名
  validateName(trimmed);
  const newPath = (await resolveMutationPathWithinLibrary(rootPath, path.relative(rootPath, path.join(path.dirname(oldPath), trimmed))));

  if ((await pathExists(newPath)) && newPath !== oldPath) {
    throw new Error("目标名称已存在");
  }

  if (oldPath !== newPath) {
    if (entry.is_directory) await assertSafeDirectoryTree(rootPath, oldPath, { rejectSymlinks: true });
    await moveWithoutReplacing(oldPath, newPath, entry.is_directory);
  }

  const now = new Date().toISOString();
  const extension = path.extname(trimmed).toLowerCase().replace(/^\./, "") || null;

  db.prepare(
    "UPDATE file_entries SET original_name = ?, extension = ?, updated_at = ? WHERE id = ?",
  ).run(trimmed, extension, now, entry.id);

  // 更新 FTS 索引（名称变了，需要重新索引）
  const renamedEntry = getEntryById(entry.id);
  if (renamedEntry) {
    recordFileEvent({
      libraryId: renamedEntry.library_id,
      fileId: renamedEntry.id,
      eventType: "renamed",
      payload: { oldName: entry.original_name, newName: trimmed },
    });
    upsertFtsIndex(renamedEntry);
  }

  });
};

/**
 * 移动条目到新的父目录（仅作用于未删除条目）
 * 非侵入式索引：物理文件名保持不变，数据库只更新 parent_id
 */
export const moveEntry = async (entryId: string, targetParentId: string | null): Promise<void> => {
  return withEntryMutation(entryId, async () => {

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

  const rootPath = (await getLibraryRoot(entry.library_id));
  const oldPath = (await getActivePathForEntry(entry, rootPath));

  const targetDirPath = targetParent
    ? (await getActivePathForEntry(targetParent, rootPath))
    : rootPath;

  if (entry.is_directory && (targetDirPath === oldPath || targetDirPath.startsWith(oldPath + path.sep))) {
    throw new Error("不能将目录移动到自身或其子目录");
  }
  if (!(await pathExists(targetDirPath))) {
    (await fs.promises.mkdir(targetDirPath, { recursive: true }));
  }

  // 使用物理文件名（带后缀）
  const physicalName = getPhysicalName(entry);
  validateName(physicalName);
  const newPath = (await resolveMutationPathWithinLibrary(rootPath, path.relative(rootPath, path.join(targetDirPath, physicalName))));

  if ((await pathExists(newPath)) && newPath !== oldPath) {
    throw new Error("目标位置已存在同名条目");
  }

  if (oldPath !== newPath) {
    if (entry.is_directory) await assertSafeDirectoryTree(rootPath, oldPath, { rejectSymlinks: true });
    await moveWithoutReplacing(oldPath, newPath, entry.is_directory);
  }

  const now = new Date().toISOString();
  const oldParentId = entry.parent_id;

  db.prepare(
    "UPDATE file_entries SET parent_id = ?, updated_at = ? WHERE id = ?",
  ).run(targetParentId, now, entry.id);

  // 更新 FTS 索引（路径变了，需要重新索引）
  const movedEntry = getEntryById(entry.id);
  if (movedEntry) {
    recordFileEvent({
      libraryId: movedEntry.library_id,
      fileId: movedEntry.id,
      eventType: "moved",
      payload: { oldParentId, newParentId: targetParentId },
    });
    upsertFtsIndex(movedEntry);
  }

  });
};

/**
 * 复制条目到新的父目录，目前仅支持文件复制
 * 非侵入式索引：复制后的文件使用原始名称
 */
export const copyEntry = async (
  entryId: string,
  targetParentId: string | null,
  newName?: string,
): Promise<string> => {
  return withEntryMutation(entryId, async () => {

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

  const rootPath = (await getLibraryRoot(entry.library_id));
  const sourcePath = (await getActivePathForEntry(entry, rootPath));

  const targetDirPath = targetParent
    ? (await getActivePathForEntry(targetParent, rootPath))
    : rootPath;

  if (!(await pathExists(targetDirPath))) {
    (await fs.promises.mkdir(targetDirPath, { recursive: true }));
  }

  // 非侵入式：直接使用原始名称作为物理文件名
  const originalName = newName && newName.trim().length > 0 ? newName.trim() : entry.original_name;
  validateName(originalName);
  const destPath = (await resolveMutationPathWithinLibrary(rootPath, path.relative(rootPath, path.join(targetDirPath, originalName))));

  if ((await pathExists(destPath))) {
    throw new Error("目标位置已存在同名文件");
  }

  (await fs.promises.copyFile(sourcePath, destPath, fs.constants.COPYFILE_EXCL));

  const stat = (await fs.promises.stat(destPath));
  const extension = path.extname(originalName).toLowerCase().replace(/^\./, "") || null;
  const now = new Date().toISOString();
  const newId = crypto.randomUUID();

  // 非侵入式：index_suffix 设为 NULL
  db.prepare(
    "INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 0, ?, NULL, ?, ?, NULL, 0, ?, ?)",
  ).run(newId, entry.library_id, targetParentId, originalName, extension, stat.size, now, now);

  // 为新复制的文件添加 FTS 索引
  const copiedEntry = getEntryById(newId);
  if (copiedEntry) {
    recordFileEvent({
      libraryId: copiedEntry.library_id,
      fileId: copiedEntry.id,
      eventType: "created",
      payload: { sourceId: entry.id },
    });
    upsertFtsIndex(copiedEntry);
  }

  return newId;

  });
};

const withEntryMutation = <T>(entryId: string, operation: () => Promise<T>): Promise<T> =>
  withLibraryMutation(getEntryByIdIncludingDeleted(entryId)?.library_id ?? -1, operation);
