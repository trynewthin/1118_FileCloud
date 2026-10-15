/** File commands: validate actor/input, apply policy, then mutate or enqueue.
 * No HTTP objects here. Existing task handlers still recheck access at execution.
 */
import fs from "node:fs";
import { withLibraryMutation } from "./mutationLock.ts";
import { pathExists } from "../../core/fs.ts";
import path from "node:path";
import { TaskTypes } from "../../core/tasks/types.ts";
import type { AuthUser } from "../../core/auth/roles.ts";
import { AccessError, assertEntryAccess, assertFileMutationAccess, assertLibraryAccess } from "../../core/auth/libraryAccess.ts";
import { assertLibraryRootPath, resolveMutationPathWithinLibrary, resolvePathWithinLibrary } from "../../core/config/pathSecurity.ts";
import { db } from "../../core/db/index.ts";
import { createTask } from "../tasks/index.ts";
import { buildRelativePathForEntry, getEntryById } from "./service.ts";
import { checkEntryPasswordIfProtected } from "./security.ts";

export type EntryCommand = "rename" | "move" | "copy" | "delete" | "restore" | "destroy";

function bodyObject(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new AccessError("请求参数不合法", 400);
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new AccessError(`${label}不合法`, 400);
  return value;
}

function checkPassword(entryId: string, password: string | undefined, label?: string): void {
  const result = checkEntryPasswordIfProtected(entryId, password);
  if (!result.ok) throw new AccessError(`${label ? `${label}：` : ""}${result.message ?? "访问密码错误"}`, 403);
}

export async function createFolder(user: AuthUser | undefined, libraryId: number, input: unknown) {
  return withLibraryMutation(libraryId, async () => {
  const actor = assertFileMutationAccess(user);
  const library = (await assertLibraryAccess(actor, libraryId));
  const root = (await assertLibraryRootPath(library.root_path));
  const body = bodyObject(input);
  const rawName = optionalString(body.name, "文件夹名称");
  const name = rawName?.trim();
  if (!name) throw new AccessError("文件夹名称不能为空", 400);
  if (/[\\/:*?"<>|\x00-\x1f]/.test(rawName!) || name === "." || name === "..") {
    throw new AccessError("文件夹名称包含非法字符", 400);
  }
  const parentId = optionalString(body.parentId, "父目录 ID") || null;
  let relativeParent = "";
  if (parentId) {
    (await assertEntryAccess(actor, parentId, { libraryId, directory: true }));
    relativeParent = buildRelativePathForEntry(getEntryById(parentId)!);
  }
  const destination = (await resolveMutationPathWithinLibrary(root, path.join(relativeParent, name)));
  if ((await pathExists(destination))) throw new AccessError("同名文件或文件夹已存在", 400);
  try {
    // Library registration permits a missing root. Bootstrap only that root,
    // never a missing indexed parent, and reserve the leaf non-recursively.
    if (!parentId) (await fs.promises.mkdir(root, { recursive: true }));
    (await fs.promises.mkdir(destination));
  } catch (error: any) {
    throw new AccessError(error.code === "EEXIST" ? "同名文件或文件夹已存在" : "创建文件夹失败", error.code === "EEXIST" ? 400 : 500);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    db.prepare("INSERT INTO file_entries(id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, created_at, updated_at) VALUES(?, ?, ?, 1, ?, NULL, NULL, 0, NULL, 0, ?, ?)")
      .run(id, libraryId, parentId, name, now, now);
  } catch (error) {
    // Only remove our empty directory; never recursively remove concurrent user data.
    try { (await fs.promises.rmdir(destination)); } catch { /* Leave recoverable data for indexing. */ }
    throw error;
  }
  return { message: "文件夹创建成功", entry: { id, name } };
  });
}

export async function submitEntryCommand(user: AuthUser | undefined, entryId: unknown, command: EntryCommand, input: unknown) {
  const actor = assertFileMutationAccess(user);
  const includeDeleted = command === "restore" || command === "destroy";
  const { entry, library } = (await assertEntryAccess(actor, entryId, { includeDeleted }));
  (await assertLibraryRootPath(library.root_path));
  const body = bodyObject(input);
  const password = optionalString(body.password, "密码");
  if (includeDeleted) {
    if (!entry.is_deleted) throw new AccessError(command === "restore" ? "文件或目录未被删除" : "仅支持对已删除条目执行彻底删除", 400);
    return createTask({ type: command === "restore" ? TaskTypes.FILE_RESTORE : TaskTypes.FILE_DESTROY, payload: { entryId: entry.id }, createdByUserId: actor.id });
  }
  if (command === "copy" && entry.is_directory) throw new AccessError("暂不支持目录复制", 400);
  const newName = command === "rename" || command === "copy" ? optionalString(body.newName, "新名称") : undefined;
  if (command === "rename" && !newName?.trim()) throw new AccessError("新名称不能为空", 400);
  let targetParentId: string | null = null;
  if (command === "move" || command === "copy") {
    // Legacy clients may still send one password for both endpoints. Each
    // explicit role credential wins independently; null/empty never silently
    // falls back to the legacy credential. Never persist these in task payloads.
    const sourcePassword = body.sourcePassword === undefined ? password : optionalString(body.sourcePassword, "源条目密码");
    const targetPassword = body.targetPassword === undefined ? password : optionalString(body.targetPassword, "目标目录密码");
    targetParentId = optionalString(body.targetParentId, "目标目录 ID") ?? null;
    if (targetParentId !== null) {
      (await assertEntryAccess(actor, targetParentId, { libraryId: entry.library_id, directory: true }));
    }
    checkPassword(entry.id, sourcePassword, "源条目");
    if (targetParentId !== null) checkPassword(targetParentId, targetPassword, "目标目录");
  } else {
    checkPassword(entry.id, password);
  }
  switch (command) {
    case "rename": return createTask({ type: TaskTypes.FILE_RENAME, payload: { entryId: entry.id, newName: newName! }, createdByUserId: actor.id });
    case "move": return createTask({ type: TaskTypes.FILE_MOVE, payload: { entryId: entry.id, targetParentId }, createdByUserId: actor.id });
    case "copy": return createTask({ type: TaskTypes.FILE_COPY, payload: { entryId: entry.id, targetParentId, newName }, createdByUserId: actor.id });
    case "delete": return createTask({ type: TaskTypes.FILE_DELETE, payload: { entryId: entry.id }, createdByUserId: actor.id });
    default: throw new AccessError("不支持的文件操作", 400);
  }
}

export async function submitIndexCommand(user: AuthUser | undefined, libraryId: number, mode: "library" | "path", input: unknown) {
  const actor = assertFileMutationAccess(user);
  const library = (await assertLibraryAccess(actor, libraryId));
  const root = (await assertLibraryRootPath(library.root_path));
  const body = bodyObject(input);
  if (mode === "library") {
    return createTask({ type: TaskTypes.FILE_INDEX_LIBRARY, payload: { libraryId, forceReindex: body.forceReindex === true }, createdByUserId: actor.id });
  }
  const relativePath = optionalString(body.relativePath, "相对路径");
  if (!relativePath) throw new AccessError("相对路径不能为空", 400);
  (await resolvePathWithinLibrary(root, relativePath));
  return createTask({ type: TaskTypes.FILE_INDEX_SINGLE, payload: { libraryId, relativePath }, createdByUserId: actor.id });
}
