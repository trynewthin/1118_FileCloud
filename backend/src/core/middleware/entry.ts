/**
 * 条目中间件
 * 统一处理条目 ID 校验、存在性检查、关联文件库加载
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import type { LibraryContext } from "./library.ts";

// 条目上下文类型
export interface EntryContext {
  id: string;
  libraryId: number;
  parentId: string | null;
  isDirectory: boolean;
  originalName: string;
  extension: string | null;
  sizeBytes: number;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      entry?: EntryContext;
      // library 已在 library.ts 中声明
    }
  }
}

// 条目数据行类型
interface EntryRow {
  id: string;
  library_id: number;
  parent_id: string | null;
  is_directory: number;
  original_name: string;
  extension: string | null;
  size_bytes: number;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 文件库数据行类型
interface LibraryRow {
  id: number;
  root_path: string;
  display_name: string;
  is_enabled: number;
}

/**
 * 根据 ID 获取条目信息
 */
const getEntryById = (id: string, includeDeleted: boolean): EntryContext | null => {
  const sql = includeDeleted
    ? "SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ?"
    : "SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ? AND is_deleted = 0";

  const row = db.prepare(sql).get(id) as EntryRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    libraryId: row.library_id,
    parentId: row.parent_id,
    isDirectory: Boolean(row.is_directory),
    originalName: row.original_name,
    extension: row.extension,
    sizeBytes: row.size_bytes,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * 根据 ID 获取文件库信息
 */
const getLibraryById = (id: number): LibraryContext | null => {
  const row = db
    .prepare(
      "SELECT id, root_path, display_name, is_enabled FROM file_libraries WHERE id = ? LIMIT 1"
    )
    .get(id) as LibraryRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    rootPath: row.root_path,
    displayName: row.display_name,
    isEnabled: Boolean(row.is_enabled),
  };
};

/**
 * 条目中间件工厂函数
 * 从路由参数中提取 entryId/id，校验条目存在，并自动加载关联的文件库
 * 
 * @param options.paramName - 路由参数名，默认先尝试 "entryId"，再尝试 "id"
 * @param options.includeDeleted - 是否包含已删除的条目，默认 false
 * @param options.requireLibraryEnabled - 是否要求关联文件库已启用，默认 true
 */
export const withEntry = (options?: {
  paramName?: string;
  includeDeleted?: boolean;
  requireLibraryEnabled?: boolean;
}) => {
  const paramName = options?.paramName;
  const includeDeleted = options?.includeDeleted ?? false;
  const requireLibraryEnabled = options?.requireLibraryEnabled ?? true;

  return (req: Request, res: Response, next: NextFunction) => {
    // 获取条目 ID
    let entryId: string | undefined;
    if (paramName) {
      entryId = req.params[paramName];
    } else {
      // 默认先尝试 entryId，再尝试 id
      entryId = req.params.entryId || req.params.id;
    }

    // 校验 ID 格式
    if (!entryId || typeof entryId !== "string") {
      return res.status(400).json({ message: "条目 ID 不合法" });
    }

    // 查询条目
    const entry = getEntryById(entryId, includeDeleted);
    if (!entry) {
      return res.status(404).json({ message: "文件或目录不存在" });
    }

    // 加载关联的文件库
    const library = getLibraryById(entry.libraryId);
    if (!library) {
      return res.status(404).json({ message: "关联的文件库不存在" });
    }

    // 校验文件库启用状态
    if (requireLibraryEnabled && !library.isEnabled) {
      return res.status(403).json({ message: "文件库未启用" });
    }

    // 挂载到请求上下文
    req.entry = entry;
    req.library = library;
    next();
  };
};

/**
 * 直接校验条目（非中间件形式）
 * 用于需要手动校验的场景
 */
export const ensureEntryExists = (
  entryId: string,
  options?: { includeDeleted?: boolean; requireLibraryEnabled?: boolean }
): 
  | { ok: true; entry: EntryContext; library: LibraryContext }
  | { ok: false; message: string } => {
  const includeDeleted = options?.includeDeleted ?? false;
  const requireLibraryEnabled = options?.requireLibraryEnabled ?? true;

  if (!entryId || typeof entryId !== "string") {
    return { ok: false, message: "条目 ID 不合法" };
  }

  const entry = getEntryById(entryId, includeDeleted);
  if (!entry) {
    return { ok: false, message: "文件或目录不存在" };
  }

  const library = getLibraryById(entry.libraryId);
  if (!library) {
    return { ok: false, message: "关联的文件库不存在" };
  }

  if (requireLibraryEnabled && !library.isEnabled) {
    return { ok: false, message: "文件库未启用" };
  }

  return { ok: true, entry, library };
};
