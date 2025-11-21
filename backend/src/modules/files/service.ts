import path from "node:path";
import { db } from "../../core/db/index.ts";

export interface FileEntry {
  id: string;
  library_id: number;
  parent_id: string | null;
  is_directory: boolean;
  original_name: string;
  extension: string | null;
  size_bytes: number;
  mime_type: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 将数据库行转换为文件索引实体
const mapRowToFileEntry = (row: any): FileEntry => {
  return {
    id: row.id,
    library_id: row.library_id,
    parent_id: row.parent_id ?? null,
    is_directory: Boolean(row.is_directory),
    original_name: row.original_name,
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
      "SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE library_id = ? AND parent_id IS ? AND is_deleted = 0 ORDER BY is_directory DESC, original_name ASC",
    )
    .all(params.libraryId, parentId) as any[];

  return rows.map(mapRowToFileEntry);
};

// 查询单个索引实体
export const getEntryById = (id: string): FileEntry | null => {
  const row = db
    .prepare(
      "SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ? AND is_deleted = 0",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToFileEntry(row);
};

// 查询单个索引实体（包含已删除记录）
export const getEntryByIdIncludingDeleted = (id: string): FileEntry | null => {
  const row = db
    .prepare(
      "SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToFileEntry(row);
};

// 基于父子关系构建相对于文件库根目录的路径
export const buildRelativePathForEntry = (entry: FileEntry): string => {
  const segments: string[] = [];

  let current: FileEntry | null = entry;

  // 向上追溯父节点，直到虚拟根（parent_id 为空）
  while (current) {
    segments.unshift(current.original_name);

    if (!current.parent_id) {
      break;
    }

    const parentRow = db
      .prepare(
        "SELECT id, library_id, parent_id, is_directory, original_name, extension, size_bytes, mime_type, is_deleted, deleted_at, created_at, updated_at FROM file_entries WHERE id = ?",
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
