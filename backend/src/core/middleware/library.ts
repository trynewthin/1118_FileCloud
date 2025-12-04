/**
 * 文件库中间件
 * 统一处理文件库 ID 校验、存在性检查、启用状态检查
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";

// 文件库上下文类型
export interface LibraryContext {
  id: number;
  rootPath: string;
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
  display_name: string;
  is_enabled: number;
}

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
 * 文件库中间件工厂函数
 * 从路由参数中提取 libraryId，校验文件库存在且已启用
 * 
 * @param options.paramName - 路由参数名，默认 "libraryId"
 * @param options.allowDisabled - 是否允许访问未启用的文件库，默认 false
 */
export const withLibrary = (options?: {
  paramName?: string;
  allowDisabled?: boolean;
}) => {
  const paramName = options?.paramName ?? "libraryId";
  const allowDisabled = options?.allowDisabled ?? false;

  return (req: Request, res: Response, next: NextFunction) => {
    const rawId = req.params[paramName];
    const libraryId = Number(rawId);

    // 校验 ID 格式
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    // 查询文件库
    const library = getLibraryById(libraryId);
    if (!library) {
      return res.status(404).json({ message: "文件库不存在" });
    }

    // 校验启用状态
    if (!allowDisabled && !library.isEnabled) {
      return res.status(403).json({ message: "文件库未启用" });
    }

    // 挂载到请求上下文
    req.library = library;
    next();
  };
};

/**
 * 直接校验文件库（非中间件形式）
 * 用于需要手动校验的场景
 */
export const ensureLibraryEnabled = (
  libraryId: number
): { ok: true; library: LibraryContext } | { ok: false; message: string } => {
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

  return { ok: true, library };
};

/**
 * 获取文件库根路径
 * 如果文件库不存在或未启用，抛出错误
 */
export const getLibraryRoot = (libraryId: number): string => {
  const result = ensureLibraryEnabled(libraryId);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.library.rootPath;
};
