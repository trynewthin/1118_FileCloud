import { db } from "../db/index.ts";
import type { AuthUser } from "./roles.ts";
import { assertLibraryRootOwnership } from "./libraryOwnership.ts";

/** The shared authorization policy for HTTP handlers and AI tools. */
export class AccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AccessError";
  }
}

export interface AccessibleLibrary {
  id: number;
  user_id: number;
  root_path: string;
  display_name: string;
  is_enabled: number;
}

export interface AccessibleEntry {
  id: string;
  library_id: number;
  parent_id: string | null;
  is_directory: number;
  original_name: string;
  extension: string | null;
  size_bytes: number;
  mime_type: string | null;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Load the current account/role instead of trusting a stale JWT or tool argument.
export const resolveAuthUser = (userId: unknown): AuthUser => {
  if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new AccessError("未登录或会话已失效", 401);
  }
  const user = db.prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(userId) as AuthUser | undefined;
  if (!user || (user.role !== "admin" && user.role !== "user")) {
    throw new AccessError("未登录或会话已失效", 401);
  }
  return user;
};

export const requireCurrentUser = (user: AuthUser | undefined): AuthUser => resolveAuthUser(user?.id);

export const assertFileMutationAccess = (user: AuthUser | undefined): AuthUser => {
  const current = requireCurrentUser(user);
  if (current.role !== "admin") throw new AccessError("权限不足", 403);
  return current;
};

export const listAccessibleLibraries = async (
  user: AuthUser | undefined,
  options?: { allowDisabled?: boolean },
): Promise<AccessibleLibrary[]> => {
  const current = requireCurrentUser(user);
  const conditions = [options?.allowDisabled ? "1 = 1" : "is_enabled = 1"];
  const params: number[] = [];
  if (current.role !== "admin") {
    conditions.push("user_id = ?");
    params.push(current.id);
  }
  const libraries = db.prepare(`SELECT id, user_id, root_path, display_name, is_enabled FROM file_libraries WHERE ${conditions.join(" AND ")}`)
    .all(...params) as AccessibleLibrary[];
  if (current.role === "admin") return libraries;
  const accessible: AccessibleLibrary[] = [];
  for (const library of libraries) {
    try {
      (await assertLibraryRootOwnership(library.root_path, current.id));
      accessible.push(library);
    } catch {
      // A failed ownership check cannot grant access.
    }
  }
  return accessible;
};

export const assertLibraryAccess = async (
  user: AuthUser | undefined,
  libraryId: unknown,
  options?: { allowDisabled?: boolean; metadataOnly?: boolean },
): Promise<AccessibleLibrary> => {
  const current = requireCurrentUser(user);
  if (typeof libraryId !== "number" || !Number.isSafeInteger(libraryId) || libraryId <= 0) {
    throw new AccessError("文件库 ID 不合法", 400);
  }
  const library = db.prepare("SELECT id, user_id, root_path, display_name, is_enabled FROM file_libraries WHERE id = ?")
    .get(libraryId) as AccessibleLibrary | undefined;
  // Do not disclose whether another user's resource exists.
  if (!library || (current.role !== "admin" && library.user_id !== current.id)) {
    throw new AccessError("文件库不存在或无权访问", 404);
  }
  if (!options?.allowDisabled && !library.is_enabled) throw new AccessError("文件库未启用", 403);
  // Metadata-only cleanup never reads the library filesystem or its entries.
  if (!options?.metadataOnly && current.role !== "admin") (await assertLibraryRootOwnership(library.root_path, current.id));
  return library;
};

export const assertEntryAccess = async (
  user: AuthUser | undefined,
  entryId: unknown,
  options?: { includeDeleted?: boolean; allowDisabled?: boolean; libraryId?: number; directory?: boolean },
): Promise<{ entry: AccessibleEntry; library: AccessibleLibrary }> => {
  requireCurrentUser(user);
  if (typeof entryId !== "string" || !entryId) throw new AccessError("条目 ID 不合法", 400);
  const entry = db.prepare("SELECT * FROM file_entries WHERE id = ?").get(entryId) as AccessibleEntry | undefined;
  if (!entry || (!options?.includeDeleted && entry.is_deleted)) throw new AccessError("文件或目录不存在", 404);
  const library = (await assertLibraryAccess(user, entry.library_id, options));
  if (options?.libraryId !== undefined && entry.library_id !== options.libraryId) {
    throw new AccessError("条目不属于当前文件库", 400);
  }
  if (options?.directory && !entry.is_directory) throw new AccessError("目标必须是一个目录", 400);
  return { entry, library };
};
