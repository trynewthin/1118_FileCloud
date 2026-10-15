/**
 * 文件库中间件
 * 统一处理文件库 ID 校验、存在性检查、启用状态检查
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import { assertLibraryAccess } from "../auth/libraryAccess.ts";
import { assertLibraryRootPath } from "../config/pathSecurity.ts";

// 文件库上下文类型
export interface LibraryContext {
  id: number;
  rootPath: string;
  userId: number;
  displayName: string;
  isEnabled: boolean;
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      library?: LibraryContext;
    }
  }
}

// 文件库数据行类型
interface LibraryRow {
  id: number;
  root_path: string;
  user_id: number;
  display_name: string;
  is_enabled: number;
}

/**
 * 根据 ID 获取文件库信息
 */
const getLibraryById = (id: number): LibraryContext | null => {
  const row = db
    .prepare(
      "SELECT id, user_id, root_path, display_name, is_enabled FROM file_libraries WHERE id = ? LIMIT 1"
    )
    .get(id) as LibraryRow | undefined;

  if (!row) return null;

  return {
    id: row.id,
    rootPath: row.root_path,
    userId: row.user_id,
    displayName: row.display_name,
    isEnabled: Boolean(row.is_enabled),
  };
};

/**
 * 文件库中间件工厂函数
 * 从路由参数中提取 libraryId，校验文件库存在且已启用
 * 
 * @param options.paramName - 路由参数名，默认 "libraryId"
 * @param options.allowDisabled - 是否允许访问未启用的文件库，默认 false
 */
export const withLibrary = (options?: {
  paramName?: string;
  allowDisabled?: boolean;
  /** Only for configuration PATCH/DELETE handlers with no filesystem I/O. */
  metadataOnly?: boolean;
}) => {
  const paramName = options?.paramName ?? "libraryId";
  const allowDisabled = options?.allowDisabled ?? false;
  const metadataOnly = options?.metadataOnly ?? false;

  return async (req: Request, res: Response, next: NextFunction) => {
    const rawId = req.params[paramName];
    const libraryId = Number(rawId);

    // 校验 ID 格式
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    try {
      const row = (await assertLibraryAccess(req.user, libraryId, { allowDisabled, metadataOnly }));
      req.library = {
        id: row.id,
        userId: row.user_id,
        rootPath: metadataOnly ? row.root_path : (await assertLibraryRootPath(row.root_path)),
        displayName: row.display_name,
        isEnabled: Boolean(row.is_enabled),
      };
    } catch (err: any) {
      return res.status(err.status ?? 403).json({ message: err.message });
    }

    next();
  };
};

/**
 * 直接校验文件库（非中间件形式）
 * 用于需要手动校验的场景
 */
export const ensureLibraryEnabled = async (
  libraryId: number
): Promise<{ ok: true; library: LibraryContext } | { ok: false; message: string }> => {
  if (!Number.isInteger(libraryId) || libraryId <= 0) {
    return { ok: false, message: "文件库 ID 不合法" };
  }

  const library = getLibraryById(libraryId);
  if (!library) {
    return { ok: false, message: "文件库不存在" };
  }

  if (!library.isEnabled) {
    return { ok: false, message: "文件库未启用" };
  }

  try {
    library.rootPath = (await assertLibraryRootPath(library.rootPath));
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
  return { ok: true, library };
};

/**
 * 获取文件库根路径
 * 如果文件库不存在或未启用，抛出错误
 */
export const getLibraryRoot = async (libraryId: number): Promise<string> => {
  const result = (await ensureLibraryEnabled(libraryId));
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.library.rootPath;
};
