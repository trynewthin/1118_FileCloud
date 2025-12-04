import fs from "node:fs";
import path from "node:path";
import { db } from "../../core/db/index.ts";
import { createTask } from "../tasks/service.ts";
import { TASK_TYPE_FILE_INDEX_LIBRARY } from "../files/indexTasks.ts";
// 注意：已移除 indexSuffix 导入，采用非侵入式索引策略

export interface FileLibrary {
  id: number;
  root_path: string;
  display_name: string;
  capacity_limit_bytes: number | null;
  current_size_bytes: number;
  is_enabled: boolean;
  is_online: boolean;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

// 递归计算目录大小（字节数），简单实现，后续可按需优化为异步任务
const calculateDirectorySize = (dir: string): number => {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += calculateDirectorySize(fullPath);
    } else if (entry.isFile()) {
      const stat = fs.statSync(fullPath);
      total += stat.size;
    }
  }

  return total;
};

// 将数据库行转换为业务层使用的文件库对象
const mapRowToFileLibrary = (row: any): FileLibrary => {
  return {
    id: row.id,
    root_path: row.root_path,
    display_name: row.display_name,
    capacity_limit_bytes: row.capacity_limit_bytes ?? null,
    current_size_bytes: row.current_size_bytes ?? 0,
    is_enabled: Boolean(row.is_enabled),
    // 在线状态以缓存为主
    is_online: Boolean(row.is_online_cached),
    last_scanned_at: row.last_scanned_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

// 查询所有文件库
export const listFileLibraries = (): FileLibrary[] => {
  const rows = db
    .prepare(
      "SELECT id, root_path, display_name, capacity_limit_bytes, current_size_bytes, is_enabled, is_online_cached, last_scanned_at, created_at, updated_at FROM file_libraries ORDER BY id ASC",
    )
    .all() as any[];

  return rows.map(mapRowToFileLibrary);
};

// 根据 id 查询单个文件库
export const getFileLibraryById = (id: number): FileLibrary | null => {
  const row = db
    .prepare(
      "SELECT id, root_path, display_name, capacity_limit_bytes, current_size_bytes, is_enabled, is_online_cached, last_scanned_at, created_at, updated_at FROM file_libraries WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToFileLibrary(row);
};

interface CreateFileLibraryInput {
  rootPath: string;
  displayName?: string;
  capacityLimitBytes?: number | null;
}

// 创建新的文件库配置
export const createFileLibrary = (input: CreateFileLibraryInput): FileLibrary => {
  const rootPath = path.resolve(input.rootPath);
  const exists = fs.existsSync(rootPath);

  const now = new Date().toISOString();

  const insert = db.prepare(
    "INSERT INTO file_libraries(root_path, display_name, capacity_limit_bytes, current_size_bytes, is_enabled, is_online_cached, last_scanned_at, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const displayName = input.displayName?.trim() || path.basename(rootPath);
  const capacityLimit =
    typeof input.capacityLimitBytes === "number"
      ? input.capacityLimitBytes
      : null;

  const result = insert.run(
    rootPath,
    displayName,
    capacityLimit,
    0,
    1,
    exists ? 1 : 0,
    null,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  // 创建文件库后自动触发一次全量索引任务，便于前端立即浏览内容
  createTask({
    type: TASK_TYPE_FILE_INDEX_LIBRARY,
    payload: { libraryId: id },
    createdByUserId: null,
  });

  return getFileLibraryById(id)!;
};

interface UpdateFileLibraryInput {
  displayName?: string;
  capacityLimitBytes?: number | null;
  isEnabled?: boolean;
}

// 更新文件库配置（不变更实际目录）
export const updateFileLibrary = (
  id: number,
  input: UpdateFileLibraryInput,
): FileLibrary | null => {
  const existing = getFileLibraryById(id);
  if (!existing) return null;

  const nextDisplayName =
    typeof input.displayName === "string" && input.displayName.trim().length > 0
      ? input.displayName.trim()
      : existing.display_name;

  const nextCapacityLimit =
    input.capacityLimitBytes === undefined
      ? existing.capacity_limit_bytes
      : input.capacityLimitBytes;

  const nextIsEnabled =
    typeof input.isEnabled === "boolean" ? input.isEnabled : existing.is_enabled;

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE file_libraries SET display_name = ?, capacity_limit_bytes = ?, is_enabled = ?, updated_at = ? WHERE id = ?",
  ).run(nextDisplayName, nextCapacityLimit, nextIsEnabled ? 1 : 0, now, id);

  return getFileLibraryById(id);
};

/**
 * 辅助函数：根据 entry_id 构建相对于文件库根目录的物理路径
 * 非侵入式索引：直接使用原始文件名构建路径
 */
const buildRelativePathForEntryId = (entryId: string): string | null => {
  const segments: string[] = [];
  let currentId: string | null = entryId;

  while (currentId) {
    const row = db
      .prepare(
        "SELECT id, parent_id, original_name FROM file_entries WHERE id = ?"
      )
      .get(currentId) as { id: string; parent_id: string | null; original_name: string } | undefined;

    if (!row) return null;

    // 非侵入式索引：直接使用原始文件名
    segments.unshift(row.original_name);

    currentId = row.parent_id;
  }

  return segments.length > 0 ? path.join(...segments) : null;
};

/**
 * 删除文件库配置记录（不删除真实目录）
 * 非侵入式索引：物理文件保持原始名称，无需恢复
 */
export const deleteFileLibrary = (id: number): boolean => {
  const library = getFileLibraryById(id);
  if (!library) return false;

  // 非侵入式索引：物理文件保持原始名称，无需重命名操作

  // 1. 删除该文件库下的所有 file_entries 记录
  db.prepare("DELETE FROM file_entries WHERE library_id = ?").run(id);

  // 2. 删除文件库配置记录
  const stmt = db.prepare("DELETE FROM file_libraries WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
};

// 刷新文件库的容量与在线状态
export const refreshFileLibraryStatus = (id: number): FileLibrary | null => {
  const existing = getFileLibraryById(id);
  if (!existing) return null;

  const exists = fs.existsSync(existing.root_path);
  const size = exists ? calculateDirectorySize(existing.root_path) : 0;
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE file_libraries SET current_size_bytes = ?, is_online_cached = ?, last_scanned_at = ?, updated_at = ? WHERE id = ?",
  ).run(size, exists ? 1 : 0, now, now, id);

  return getFileLibraryById(id);
};
