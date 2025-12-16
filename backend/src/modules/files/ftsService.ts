/**
 * FTS5 全文搜索索引服务
 * 
 * 功能：
 * 1. 单条记录的 FTS 索引同步（插入/更新/删除）
 * 2. 按库重建 FTS 索引
 * 3. 基于 FTS5 的全文搜索
 * 4. 文件事件记录
 */

import { db } from "../../core/db/index.ts";
import { getEntryAncestors, type FileEntry } from "./service.ts";

// ============================================================================
// 类型定义
// ============================================================================

export interface FtsSearchResult {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  extension: string | null;
  // FTS5 匹配分数（可选，用于排序）
  rank?: number;
}

export interface FileEvent {
  id: number;
  library_id: number;
  file_id: string;
  event_type: "created" | "updated" | "moved" | "renamed" | "deleted";
  payload_json: string | null;
  processed: boolean;
  created_at: string;
}

// ============================================================================
// FTS 索引操作
// ============================================================================

/**
 * 构建文件的完整路径（用于 FTS 索引）
 * 返回格式：/祖先1/祖先2/.../文件名
 */
const buildFullPath = (entry: FileEntry): string => {
  const ancestors = getEntryAncestors(entry);
  const pathParts = ancestors.map((a) => a.name);
  pathParts.push(entry.original_name);
  return "/" + pathParts.join("/");
};

/**
 * 向 FTS5 索引中插入或更新一条记录
 * 使用 INSERT OR REPLACE 语义（contentless FTS5 需要先删后插）
 */
export const upsertFtsIndex = (entry: FileEntry): void => {
  const fullPath = buildFullPath(entry);
  
  // contentless FTS5 需要先删除旧记录
  db.prepare("DELETE FROM file_index_fts WHERE file_id = ?").run(entry.id);
  
  // 插入新记录
  db.prepare(`
    INSERT INTO file_index_fts(file_id, library_id, name, path, extension)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.library_id.toString(),
    entry.original_name,
    fullPath,
    entry.extension || ""
  );
};

/**
 * 从 FTS5 索引中删除一条记录
 */
export const deleteFtsIndex = (fileId: string): void => {
  db.prepare("DELETE FROM file_index_fts WHERE file_id = ?").run(fileId);
};

/**
 * 批量插入 FTS 索引（用于全量重建）
 * 返回成功插入的数量
 */
export const batchUpsertFtsIndex = (entries: FileEntry[]): number => {
  if (entries.length === 0) return 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO file_index_fts(file_id, library_id, name, path, extension)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const entry of entries) {
    try {
      const fullPath = buildFullPath(entry);
      insertStmt.run(
        entry.id,
        entry.library_id.toString(),
        entry.original_name,
        fullPath,
        entry.extension || ""
      );
      count++;
    } catch (err) {
      console.error(`FTS 索引插入失败 [${entry.id}]:`, err);
    }
  }
  
  return count;
};

/**
 * 清空指定文件库的 FTS 索引
 */
export const clearFtsIndexByLibrary = (libraryId: number): number => {
  const result = db.prepare("DELETE FROM file_index_fts WHERE library_id = ?").run(libraryId.toString());
  return result.changes;
};

/**
 * 清空所有 FTS 索引
 */
export const clearAllFtsIndex = (): number => {
  const result = db.prepare("DELETE FROM file_index_fts").run();
  return result.changes;
};

// ============================================================================
// FTS 搜索
// ============================================================================

/**
 * 使用 FTS5 进行全文搜索
 * 
 * @param params.libraryId - 文件库 ID
 * @param params.keyword - 搜索关键词
 * @param params.pathPrefix - 路径前缀过滤（可选，用于"当前目录内搜索"）
 * @param params.extension - 扩展名过滤（可选）
 * @param params.type - 类型过滤：all/file/directory
 * @param params.limit - 返回数量限制
 */
export const searchByFts = (params: {
  libraryId: number;
  keyword: string;
  pathPrefix?: string;
  extension?: string;
  extensions?: string[];
  type?: "all" | "file" | "directory";
  limit?: number;
}): FtsSearchResult[] => {
  const { libraryId, keyword, pathPrefix, extension, extensions, type = "all", limit = 50 } = params;
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  // 构建 FTS5 查询表达式
  // 对关键词进行转义和处理
  const escapedKeyword = keyword.trim()
    .replace(/"/g, '""')  // 转义双引号
    .split(/\s+/)         // 按空格分词
    .filter(Boolean)
    .map(word => `"${word}"*`)  // 每个词加前缀匹配
    .join(" ");
  
  if (!escapedKeyword) {
    return [];
  }
  
  // 使用 FTS5 MATCH 查询
  // 注意：FTS5 的 MATCH 语法
  let sql = `
    SELECT 
      fts.file_id,
      fts.name,
      fts.path,
      fts.extension,
      bm25(file_index_fts) as rank,
      fe.is_directory,
      fe.size_bytes
    FROM file_index_fts fts
    JOIN file_entries fe ON fts.file_id = fe.id
    WHERE fts.library_id = ?
      AND file_index_fts MATCH ?
      AND fe.is_deleted = 0
  `;
  
  const sqlParams: any[] = [libraryId.toString(), escapedKeyword];
  
  // 路径前缀过滤
  if (pathPrefix) {
    sql += " AND fts.path LIKE ?";
    sqlParams.push(pathPrefix + "%");
  }
  
  // 扩展名过滤
  const normalizedExtensions = (() => {
    const out: string[] = [];
    if (typeof extension === "string" && extension.trim()) {
      out.push(extension.trim().toLowerCase());
    }
    if (Array.isArray(extensions)) {
      for (const ext of extensions) {
        if (typeof ext !== "string") continue;
        const trimmed = ext.trim().toLowerCase();
        if (!trimmed) continue;
        out.push(trimmed);
      }
    }
    return Array.from(new Set(out));
  })();

  if (normalizedExtensions.length > 0) {
    const placeholders = normalizedExtensions.map(() => "?").join(",");
    sql += ` AND fts.extension IN (${placeholders})`;
    sqlParams.push(...normalizedExtensions);
  }
  
  // 类型过滤
  if (type === "file") {
    sql += " AND fe.is_directory = 0";
  } else if (type === "directory") {
    sql += " AND fe.is_directory = 1";
  }
  
  // 按相关性排序，目录优先
  sql += " ORDER BY fe.is_directory DESC, rank LIMIT ?";
  sqlParams.push(limit);
  
  try {
    const rows = db.prepare(sql).all(...sqlParams) as any[];
    
    return rows.map((row) => ({
      id: row.file_id,
      name: row.name,
      path: row.path,
      isDirectory: Boolean(row.is_directory),
      size: row.size_bytes ?? 0,
      extension: row.extension || null,
      rank: row.rank,
    }));
  } catch (err) {
    // FTS5 查询语法错误时降级到 LIKE 查询
    console.warn("FTS5 查询失败，降级到 LIKE 查询:", err);
    return searchByLike(params);
  }
};

/**
 * 降级的 LIKE 搜索（当 FTS5 查询失败时使用）
 */
const searchByLike = (params: {
  libraryId: number;
  keyword: string;
  pathPrefix?: string;
  extension?: string;
  extensions?: string[];
  type?: "all" | "file" | "directory";
  limit?: number;
}): FtsSearchResult[] => {
  const { libraryId, keyword, pathPrefix, extension, extensions, type = "all", limit = 50 } = params;
  
  const searchPattern = `%${keyword.trim()}%`;
  
  let sql = `
    SELECT 
      fe.id as file_id,
      fe.original_name as name,
      COALESCE(fts.path, '') as path,
      COALESCE(NULLIF(fts.extension, ''), fe.extension) as extension,
      fe.is_directory,
      fe.size_bytes
    FROM file_entries fe
    LEFT JOIN file_index_fts fts ON fts.file_id = fe.id
    WHERE fe.library_id = ? AND fe.is_deleted = 0 AND fe.original_name LIKE ?
  `;
  
  const sqlParams: any[] = [libraryId, searchPattern];

  if (pathPrefix) {
    sql += " AND fts.path LIKE ?";
    sqlParams.push(pathPrefix + "%");
  }

  const normalizedExtensions = (() => {
    const out: string[] = [];
    if (typeof extension === "string" && extension.trim()) {
      out.push(extension.trim().toLowerCase());
    }
    if (Array.isArray(extensions)) {
      for (const ext of extensions) {
        if (typeof ext !== "string") continue;
        const trimmed = ext.trim().toLowerCase();
        if (!trimmed) continue;
        out.push(trimmed);
      }
    }
    return Array.from(new Set(out));
  })();

  if (normalizedExtensions.length > 0) {
    const placeholders = normalizedExtensions.map(() => "?").join(",");
    sql += ` AND lower(COALESCE(NULLIF(fts.extension, ''), fe.extension, '')) IN (${placeholders})`;
    sqlParams.push(...normalizedExtensions);
  }
  
  if (type === "file") {
    sql += " AND fe.is_directory = 0";
  } else if (type === "directory") {
    sql += " AND fe.is_directory = 1";
  }
  
  sql += " ORDER BY fe.is_directory DESC, fe.original_name ASC LIMIT ?";
  sqlParams.push(limit);
  
  const rows = db.prepare(sql).all(...sqlParams) as any[];

  return rows.map((row) => {
    const rawPath = typeof row.path === "string" ? row.path : "";
    const path = rawPath && rawPath.startsWith("/") ? rawPath : rawPath ? "/" + rawPath : "";
    return {
      id: row.file_id,
      name: row.name,
      path: path || "/" + row.name,
      isDirectory: Boolean(row.is_directory),
      size: row.size_bytes ?? 0,
      extension: row.extension || null,
    };
  }).filter((item): item is FtsSearchResult => item !== null);
};

/**
 * 获取祖先名称列表（用于构建路径）
 */
const getAncestorNames = (entryId: string): string[] => {
  const names: string[] = [];
  let currentId = entryId;
  
  // 先获取当前条目的 parent_id
  const current = db.prepare("SELECT parent_id FROM file_entries WHERE id = ?").get(currentId) as { parent_id: string | null } | undefined;
  if (!current || !current.parent_id) return names;
  
  currentId = current.parent_id;
  
  while (currentId) {
    const row = db.prepare("SELECT parent_id, original_name FROM file_entries WHERE id = ?").get(currentId) as { parent_id: string | null; original_name: string } | undefined;
    if (!row) break;
    names.unshift(row.original_name);
    if (!row.parent_id) break;
    currentId = row.parent_id;
  }
  
  return names;
};

// ============================================================================
// 文件事件记录
// ============================================================================

/**
 * 记录文件事件
 */
export const recordFileEvent = (params: {
  libraryId: number;
  fileId: string;
  eventType: "created" | "updated" | "moved" | "renamed" | "deleted";
  payload?: Record<string, any>;
}): void => {
  const { libraryId, fileId, eventType, payload } = params;
  
  db.prepare(`
    INSERT INTO file_events(library_id, file_id, event_type, payload_json, processed)
    VALUES (?, ?, ?, ?, 0)
  `).run(
    libraryId,
    fileId,
    eventType,
    payload ? JSON.stringify(payload) : null
  );
};

/**
 * 获取未处理的文件事件
 */
export const getUnprocessedEvents = (limit: number = 100): FileEvent[] => {
  const rows = db.prepare(`
    SELECT id, library_id, file_id, event_type, payload_json, processed, created_at
    FROM file_events
    WHERE processed = 0
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as any[];
  
  return rows.map((row) => ({
    id: row.id,
    library_id: row.library_id,
    file_id: row.file_id,
    event_type: row.event_type,
    payload_json: row.payload_json,
    processed: Boolean(row.processed),
    created_at: row.created_at,
  }));
};

/**
 * 标记事件为已处理
 */
export const markEventsProcessed = (eventIds: number[]): void => {
  if (eventIds.length === 0) return;
  
  const placeholders = eventIds.map(() => "?").join(",");
  db.prepare(`UPDATE file_events SET processed = 1 WHERE id IN (${placeholders})`).run(...eventIds);
};

/**
 * 处理未处理的文件事件，更新 FTS 索引
 * 返回处理的事件数量
 */
export const processFileEvents = (limit: number = 100): number => {
  const events = getUnprocessedEvents(limit);
  if (events.length === 0) return 0;
  
  const processedIds: number[] = [];
  
  for (const event of events) {
    try {
      if (event.event_type === "deleted") {
        // 删除事件：从 FTS 中移除
        deleteFtsIndex(event.file_id);
      } else {
        // 其他事件：更新 FTS 索引
        const entry = db.prepare(`
          SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes
          FROM file_entries WHERE id = ? AND is_deleted = 0
        `).get(event.file_id) as any;
        
        if (entry) {
          const fileEntry: FileEntry = {
            id: entry.id,
            library_id: entry.library_id,
            parent_id: entry.parent_id ?? null,
            is_directory: Boolean(entry.is_directory),
            original_name: entry.original_name,
            index_suffix: entry.index_suffix ?? null,
            extension: entry.extension ?? null,
            size_bytes: entry.size_bytes ?? 0,
            mime_type: entry.mime_type ?? null,
            is_deleted: false,
            deleted_at: null,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
          };
          upsertFtsIndex(fileEntry);
        } else {
          // 条目不存在或已删除，从 FTS 中移除
          deleteFtsIndex(event.file_id);
        }
      }
      processedIds.push(event.id);
    } catch (err) {
      console.error(`处理文件事件失败 [${event.id}]:`, err);
    }
  }
  
  if (processedIds.length > 0) {
    markEventsProcessed(processedIds);
  }
  
  return processedIds.length;
};

// ============================================================================
// FTS 索引重建
// ============================================================================

/**
 * 重建指定文件库的 FTS 索引
 * 
 * @param libraryId - 文件库 ID
 * @param onProgress - 进度回调
 * @returns 索引的文件数量
 */
export const rebuildFtsIndexForLibrary = (
  libraryId: number,
  onProgress?: (current: number, total: number) => void
): number => {
  // 1. 清空该库的 FTS 索引
  clearFtsIndexByLibrary(libraryId);
  
  // 2. 查询该库所有未删除的文件条目
  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM file_entries WHERE library_id = ? AND is_deleted = 0
  `).get(libraryId) as { total: number };
  
  const total = countRow.total;
  if (total === 0) return 0;
  
  // 3. 分批处理
  const batchSize = 500;
  let processed = 0;
  let offset = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO file_index_fts(file_id, library_id, name, path, extension)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  while (offset < total) {
    const rows = db.prepare(`
      SELECT id, library_id, parent_id, is_directory, original_name, extension
      FROM file_entries 
      WHERE library_id = ? AND is_deleted = 0
      ORDER BY id
      LIMIT ? OFFSET ?
    `).all(libraryId, batchSize, offset) as any[];
    
    for (const row of rows) {
      try {
        // 构建路径
        const ancestors = getAncestorNames(row.id);
        const pathParts = [...ancestors, row.original_name];
        const fullPath = "/" + pathParts.join("/");
        
        insertStmt.run(
          row.id,
          row.library_id.toString(),
          row.original_name,
          fullPath,
          row.extension || ""
        );
        processed++;
      } catch (err) {
        console.error(`FTS 索引重建失败 [${row.id}]:`, err);
      }
    }
    
    offset += batchSize;
    
    if (onProgress) {
      onProgress(processed, total);
    }
  }
  
  return processed;
};

/**
 * 获取 FTS 索引统计信息
 */
export const getFtsIndexStats = (libraryId?: number): { total: number; byLibrary: Record<number, number> } => {
  if (libraryId !== undefined) {
    const row = db.prepare("SELECT COUNT(*) as total FROM file_index_fts WHERE library_id = ?").get(libraryId.toString()) as { total: number };
    return { total: row.total, byLibrary: { [libraryId]: row.total } };
  }
  
  const totalRow = db.prepare("SELECT COUNT(*) as total FROM file_index_fts").get() as { total: number };
  const byLibraryRows = db.prepare(`
    SELECT library_id, COUNT(*) as count FROM file_index_fts GROUP BY library_id
  `).all() as { library_id: string; count: number }[];
  
  const byLibrary: Record<number, number> = {};
  for (const row of byLibraryRows) {
    byLibrary[parseInt(row.library_id)] = row.count;
  }
  
  return { total: totalRow.total, byLibrary };
};
