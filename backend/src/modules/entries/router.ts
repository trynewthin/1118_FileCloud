/**
 * 统一文件条目路由
 * 提供跨库的文件访问接口，淡化库的存在
 */
import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { db } from "../../core/db/index.ts";
import {
  getAllLibraryStatus,
  isLibraryOnline,
  getCheckInterval,
} from "../../core/services/index.ts";

const router = express.Router();

// ============================================================================
// 类型定义
// ============================================================================

interface UnifiedFileEntry {
  id: string;
  library_id: number;
  library_name: string;
  library_online: boolean;
  parent_id: string | null;
  is_directory: boolean;
  original_name: string;
  extension: string | null;
  size_bytes: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface LibraryStatusResponse {
  id: number;
  display_name: string;
  root_path: string;
  is_enabled: boolean;
  is_online: boolean;
  last_check_at: string | null;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 将数据库行转换为统一文件条目
 */
const mapRowToUnifiedEntry = (
  row: any,
  libraryName: string,
  libraryOnline: boolean
): UnifiedFileEntry => ({
  id: row.id,
  library_id: row.library_id,
  library_name: libraryName,
  library_online: libraryOnline,
  parent_id: row.parent_id,
  is_directory: Boolean(row.is_directory),
  original_name: row.original_name,
  extension: row.extension,
  size_bytes: row.size_bytes,
  is_deleted: Boolean(row.is_deleted),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/**
 * 获取库名称映射
 */
const getLibraryNameMap = (): Map<number, string> => {
  const rows = db
    .prepare("SELECT id, display_name FROM file_libraries")
    .all() as { id: number; display_name: string }[];

  const map = new Map<number, string>();
  for (const row of rows) {
    map.set(row.id, row.display_name);
  }
  return map;
};

// ============================================================================
// 路由定义
// ============================================================================

/**
 * 获取所有文件库的状态
 * GET /api/entries/libraries/status
 */
router.get(
  "/libraries/status",
  authenticate,
  requirePermission(PermissionLevel.User),
  (_req, res) => {
    const statuses = getAllLibraryStatus();

    const response: {
      libraries: LibraryStatusResponse[];
      check_interval_ms: number;
    } = {
      libraries: statuses.map((s) => ({
        id: s.id,
        display_name: s.displayName,
        root_path: s.rootPath,
        is_enabled: s.isEnabled,
        is_online: s.isOnline,
        last_check_at: s.lastCheckAt,
      })),
      check_interval_ms: getCheckInterval(),
    };

    return res.json(response);
  }
);

/**
 * 统一文件列表
 * GET /api/entries
 * 
 * 查询参数：
 * - parentId: 父目录 ID（可选，不传则返回所有库的根目录内容）
 * - libraryIds: 限定库 ID，逗号分隔（可选）
 * - includeOffline: 是否包含离线库的文件，默认 true
 * - page: 页码，默认 1
 * - pageSize: 每页数量，默认 100，最大 500
 */
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const {
      parentId,
      libraryIds: libraryIdsStr,
      includeOffline = "true",
      page = "1",
      pageSize = "100",
    } = req.query as {
      parentId?: string;
      libraryIds?: string;
      includeOffline?: string;
      page?: string;
      pageSize?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(500, Math.max(1, parseInt(pageSize, 10) || 100));
    const offset = (pageNum - 1) * pageSizeNum;
    const includeOfflineLibraries = includeOffline !== "false";

    // 解析库 ID 过滤
    let libraryIdFilter: number[] | null = null;
    if (libraryIdsStr) {
      libraryIdFilter = libraryIdsStr
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
    }

    // 获取库名称和状态
    const libraryNameMap = getLibraryNameMap();
    const allStatuses = getAllLibraryStatus();
    const onlineStatusMap = new Map<number, boolean>();
    for (const s of allStatuses) {
      onlineStatusMap.set(s.id, s.isOnline);
    }

    // 构建查询条件
    let sql: string;
    let countSql: string;
    const params: any[] = [];

    if (parentId) {
      // 查询指定父目录下的内容
      sql = `
        SELECT e.id, e.library_id, e.parent_id, e.is_directory, e.original_name, 
               e.extension, e.size_bytes, e.is_deleted, e.created_at, e.updated_at
        FROM file_entries e
        JOIN file_libraries l ON e.library_id = l.id
        WHERE e.parent_id = ? AND e.is_deleted = 0 AND l.is_enabled = 1
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM file_entries e
        JOIN file_libraries l ON e.library_id = l.id
        WHERE e.parent_id = ? AND e.is_deleted = 0 AND l.is_enabled = 1
      `;
      params.push(parentId);
    } else {
      // 查询所有库的根目录内容
      sql = `
        SELECT e.id, e.library_id, e.parent_id, e.is_directory, e.original_name, 
               e.extension, e.size_bytes, e.is_deleted, e.created_at, e.updated_at
        FROM file_entries e
        JOIN file_libraries l ON e.library_id = l.id
        WHERE e.parent_id IS NULL AND e.is_deleted = 0 AND l.is_enabled = 1
      `;
      countSql = `
        SELECT COUNT(*) as total
        FROM file_entries e
        JOIN file_libraries l ON e.library_id = l.id
        WHERE e.parent_id IS NULL AND e.is_deleted = 0 AND l.is_enabled = 1
      `;
    }

    // 添加库 ID 过滤
    if (libraryIdFilter && libraryIdFilter.length > 0) {
      const placeholders = libraryIdFilter.map(() => "?").join(",");
      sql += ` AND e.library_id IN (${placeholders})`;
      countSql += ` AND e.library_id IN (${placeholders})`;
      params.push(...libraryIdFilter);
    }

    // 排序和分页
    sql += " ORDER BY e.is_directory DESC, e.original_name ASC LIMIT ? OFFSET ?";

    // 执行查询
    const countParams = [...params];
    params.push(pageSizeNum, offset);

    const rows = db.prepare(sql).all(...params) as any[];
    const countResult = db.prepare(countSql).get(...countParams) as { total: number };

    // 转换结果，添加库状态
    const items: UnifiedFileEntry[] = [];
    const involvedLibraries = new Set<number>();

    for (const row of rows) {
      const libraryOnline = onlineStatusMap.get(row.library_id) ?? false;

      // 如果不包含离线库，跳过离线库的文件
      if (!includeOfflineLibraries && !libraryOnline) {
        continue;
      }

      involvedLibraries.add(row.library_id);
      items.push(
        mapRowToUnifiedEntry(
          row,
          libraryNameMap.get(row.library_id) || `库 ${row.library_id}`,
          libraryOnline
        )
      );
    }

    // 构建涉及的库状态列表
    const libraries: LibraryStatusResponse[] = allStatuses
      .filter((s) => involvedLibraries.has(s.id))
      .map((s) => ({
        id: s.id,
        display_name: s.displayName,
        root_path: s.rootPath,
        is_enabled: s.isEnabled,
        is_online: s.isOnline,
        last_check_at: s.lastCheckAt,
      }));

    return res.json({
      items,
      libraries,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total: countResult.total,
      },
    });
  }
);

/**
 * 跨库搜索
 * GET /api/entries/search
 * 
 * 查询参数：
 * - q: 搜索关键词（必填）
 * - libraryIds: 限定库 ID，逗号分隔（可选）
 * - type: 类型过滤 all/file/directory，默认 all
 * - limit: 返回数量限制，默认 50，最大 200
 */
router.get(
  "/search",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const {
      q,
      libraryIds: libraryIdsStr,
      type = "all",
      limit = "50",
    } = req.query as {
      q?: string;
      libraryIds?: string;
      type?: string;
      limit?: string;
    };

    if (!q || q.trim().length === 0) {
      return res.json({ items: [], libraries: [] });
    }

    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const keyword = q.trim();

    // 解析库 ID 过滤
    let libraryIdFilter: number[] | null = null;
    if (libraryIdsStr) {
      libraryIdFilter = libraryIdsStr
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
    }

    // 获取库名称和状态
    const libraryNameMap = getLibraryNameMap();
    const allStatuses = getAllLibraryStatus();
    const onlineStatusMap = new Map<number, boolean>();
    for (const s of allStatuses) {
      onlineStatusMap.set(s.id, s.isOnline);
    }

    // 使用 FTS5 搜索
    let sql = `
      SELECT e.id, e.library_id, e.parent_id, e.is_directory, e.original_name, 
             e.extension, e.size_bytes, e.is_deleted, e.created_at, e.updated_at
      FROM file_entries e
      JOIN file_libraries l ON e.library_id = l.id
      JOIN file_index_fts fts ON e.id = fts.file_id
      WHERE fts.name MATCH ? AND e.is_deleted = 0 AND l.is_enabled = 1
    `;
    const params: any[] = [`"${keyword}"*`];

    // 类型过滤
    if (type === "file") {
      sql += " AND e.is_directory = 0";
    } else if (type === "directory") {
      sql += " AND e.is_directory = 1";
    }

    // 库 ID 过滤
    if (libraryIdFilter && libraryIdFilter.length > 0) {
      const placeholders = libraryIdFilter.map(() => "?").join(",");
      sql += ` AND e.library_id IN (${placeholders})`;
      params.push(...libraryIdFilter);
    }

    sql += " ORDER BY e.is_directory DESC, e.original_name ASC LIMIT ?";
    params.push(limitNum);

    const rows = db.prepare(sql).all(...params) as any[];

    // 转换结果
    const items: UnifiedFileEntry[] = [];
    const involvedLibraries = new Set<number>();

    for (const row of rows) {
      const libraryOnline = onlineStatusMap.get(row.library_id) ?? false;
      involvedLibraries.add(row.library_id);
      items.push(
        mapRowToUnifiedEntry(
          row,
          libraryNameMap.get(row.library_id) || `库 ${row.library_id}`,
          libraryOnline
        )
      );
    }

    // 构建涉及的库状态列表
    const libraries: LibraryStatusResponse[] = allStatuses
      .filter((s) => involvedLibraries.has(s.id))
      .map((s) => ({
        id: s.id,
        display_name: s.displayName,
        root_path: s.rootPath,
        is_enabled: s.isEnabled,
        is_online: s.isOnline,
        last_check_at: s.lastCheckAt,
      }));

    return res.json({ items, libraries });
  }
);

export { router as entriesRouter };
