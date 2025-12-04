import fs from "node:fs";
import path from "node:path";
import { db } from "../../core/db/index.ts";
// 注意：已移除 indexSuffix 导入，采用非侵入式索引策略
// 物理文件保持原始名称，不再使用 [xxxxxx] 后缀

export interface FileEntry {
  id: string;
  library_id: number;
  parent_id: string | null;
  is_directory: boolean;
  original_name: string;
  index_suffix: string | null;  // 已废弃：非侵入式索引不再使用后缀
  extension: string | null;
  size_bytes: number;
  mime_type: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const INTERNAL_META_DIR = ".filecloud_meta";
const TRASH_DIR_NAME = "trash";

// 将数据库行转换为文件索引实体
const mapRowToFileEntry = (row: any): FileEntry => {
  return {
    id: row.id,
    library_id: row.library_id,
    parent_id: row.parent_id ?? null,
    is_directory: Boolean(row.is_directory),
    original_name: row.original_name,
    index_suffix: row.index_suffix ?? null,
    extension: row.extension ?? null,
    size_bytes: row.size_bytes ?? 0,
    mime_type: row.mime_type ?? null,
    is_deleted: Boolean(row.is_deleted),
    deleted_at: row.deleted_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

// 查询指定文件库下的子项列表（单层，不含递归）
export const listEntriesByParent = (params: {
  libraryId: number;
  parentId?: string | null;
}): FileEntry[] => {
  const parentId = params.parentId ?? null;

  const rows = db
    .prepare(
      "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE library_id = ? AND parent_id IS ? AND is_deleted = 0 ORDER BY is_directory DESC, original_name ASC",
    )
    .all(params.libraryId, parentId) as any[];

  return rows.map(mapRowToFileEntry);
};

// 回收站条目类型，附带相对于文件库根目录的路径
export interface TrashEntry extends FileEntry {
  relative_path: string;
}

// 查询指定文件库中的已删除条目（回收站），按删除时间倒序
export const listDeletedEntriesByLibrary = (libraryId: number): TrashEntry[] => {
  const libRow = db
    .prepare("SELECT root_path FROM file_libraries WHERE id = ? LIMIT 1")
    .get(libraryId) as { root_path: string } | undefined;

  if (!libRow) {
    return [];
  }

  const libraryRootPath = libRow.root_path;

  const rows = db
    .prepare(
      "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE library_id = ? AND is_deleted = 1 ORDER BY deleted_at DESC, original_name ASC",
    )
    .all(libraryId) as any[];

  return rows
    .map((row) => {
      const entry = mapRowToFileEntry(row);
      const relative = buildRelativePathForEntry(entry);
      const trashPath = path.join(
        libraryRootPath,
        INTERNAL_META_DIR,
        TRASH_DIR_NAME,
        relative,
      );

      if (!fs.existsSync(trashPath)) {
        return null;
      }

      return { ...entry, relative_path: relative } as TrashEntry | null;
    })
    .filter((item): item is TrashEntry => item !== null);
};

// 查询单个索引实体
export const getEntryById = (id: string): FileEntry | null => {
  const row = db
    .prepare(
      "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ? AND is_deleted = 0",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToFileEntry(row);
};

// 查询单个索引实体（包含已删除记录）
export const getEntryByIdIncludingDeleted = (id: string): FileEntry | null => {
  const row = db
    .prepare(
      "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToFileEntry(row);
};

/**
 * 获取条目的物理文件名
 * 非侵入式索引：直接返回原始文件名
 */
export const getPhysicalName = (entry: FileEntry): string => {
  return entry.original_name;
};

/**
 * 基于父子关系构建相对于文件库根目录的物理路径
 * 非侵入式索引：使用原始文件名构建路径
 */
export const buildRelativePathForEntry = (entry: FileEntry): string => {
  const segments: string[] = [];

  let current: FileEntry | null = entry;

  // 向上追溯父节点，直到虚拟根（parent_id 为空）
  while (current) {
    // 非侵入式索引：直接使用原始文件名
    segments.unshift(getPhysicalName(current));

    if (!current.parent_id) {
      break;
    }

    const parentRow = db
      .prepare(
        "SELECT id, library_id, parent_id, is_directory, original_name, index_suffix, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ?",
      )
      .get(current.parent_id) as any | undefined;

    if (!parentRow) {
      break;
    }

    current = mapRowToFileEntry(parentRow);
  }

  return path.join(...segments);
};

// 获取指定条目的所有祖先节点（从根到直接父级），用于构建面包屑
export const getEntryAncestors = (entry: FileEntry): { id: string; name: string }[] => {
  const ancestors: { id: string; name: string }[] = [];
  let currentParentId = entry.parent_id;

  while (currentParentId) {
    const parentRow = db
      .prepare(
        "SELECT id, parent_id, original_name FROM file_entries WHERE id = ?",
      )
      .get(currentParentId) as { id: string; parent_id: string | null; original_name: string } | undefined;

    if (!parentRow) break;

    ancestors.unshift({
      id: parentRow.id,
      name: parentRow.original_name,
    });

    currentParentId = parentRow.parent_id;
  }

  return ancestors;
};

// 解析指定索引对应的真实文件路径（内部使用，接口层不会直接返回）
export const resolveRealPathForEntry = (entry: FileEntry, libraryRootPath: string): string => {
  const relative = buildRelativePathForEntry(entry);
  return path.join(libraryRootPath, relative);
};

// 搜索文件夹（按名称模糊匹配）
export interface FolderSearchResult {
  id: string;
  name: string;
  path: string; // 完整路径，用于显示
}

export const searchFolders = (params: {
  libraryId: number;
  keyword: string;
  excludeId?: string; // 排除指定条目（避免移动到自身）
  limit?: number;
}): FolderSearchResult[] => {
  const { libraryId, keyword, excludeId, limit = 20 } = params;
  
  if (!keyword || keyword.trim().length === 0) {
    return [];
  }

  const searchPattern = `%${keyword.trim()}%`;
  
  // 查询匹配的文件夹
  let sql = `
    SELECT id, original_name 
    FROM file_entries 
    WHERE library_id = ? 
      AND is_directory = 1 
      AND is_deleted = 0 
      AND original_name LIKE ?
  `;
  const sqlParams: any[] = [libraryId, searchPattern];
  
  if (excludeId) {
    sql += " AND id != ?";
    sqlParams.push(excludeId);
  }
  
  sql += " ORDER BY original_name ASC LIMIT ?";
  sqlParams.push(limit);

  const rows = db.prepare(sql).all(...sqlParams) as { id: string; original_name: string }[];

  // 为每个结果构建完整路径
  return rows.map((row) => {
    const entry = getEntryById(row.id);
    if (!entry) return null;
    
    const ancestors = getEntryAncestors(entry);
    const pathParts = ancestors.map((a) => a.name);
    pathParts.push(entry.original_name);
    
    return {
      id: row.id,
      name: row.original_name,
      path: "/" + pathParts.join("/"),
    };
  }).filter((item): item is FolderSearchResult => item !== null);
};

// 搜索结果类型
export interface FileSearchResult {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  extension: string | null;
}

// 搜索文件和目录
export const searchEntries = (params: {
  libraryId: number;
  keyword: string;
  type?: "all" | "file" | "directory";
  limit?: number;
}): FileSearchResult[] => {
  const { libraryId, keyword, type = "all", limit = 50 } = params;
  
  if (!keyword || !keyword.trim()) {
    return [];
  }

  const searchPattern = `%${keyword.trim()}%`;
  
  let sql = `
    SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes
    FROM file_entries 
    WHERE library_id = ? AND is_deleted = 0 AND original_name LIKE ?
  `;
  
  if (type === "file") {
    sql += " AND is_directory = 0";
  } else if (type === "directory") {
    sql += " AND is_directory = 1";
  }
  
  sql += " ORDER BY is_directory DESC, original_name ASC LIMIT ?";
  
  const rows = db.prepare(sql).all(libraryId, searchPattern, limit) as any[];
  
  return rows.map((row) => {
    const entry = getEntryById(row.id);
    if (!entry) return null;
    
    const ancestors = getEntryAncestors(entry);
    const pathParts = ancestors.map((a) => a.name);
    pathParts.push(entry.original_name);
    
    return {
      id: row.id,
      name: row.original_name,
      path: "/" + pathParts.join("/"),
      isDirectory: Boolean(row.is_directory),
      size: row.size_bytes ?? 0,
      extension: row.extension ?? null,
    };
  }).filter((item): item is FileSearchResult => item !== null);
};
