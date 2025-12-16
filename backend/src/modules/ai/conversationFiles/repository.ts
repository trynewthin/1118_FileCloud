// ============================================================================
// AI 会话文件服务 - 数据库操作层
// ============================================================================

import { db } from "../../../core/db/index.ts";
import type {
  ConversationFile,
  CreateConversationFileInput,
  ListConversationFilesOptions,
} from "./types.ts";

// 映射数据库行到实体
const mapRowToFile = (row: any): ConversationFile => {
  return {
    id: row.id,
    user_id: row.user_id,
    conversation_id: row.conversation_id ?? null,
    message_id: row.message_id ?? null,
    origin: row.origin,
    purpose: row.purpose,
    original_name: row.original_name,
    stored_name: row.stored_name,
    extension: row.extension ?? null,
    mime_type: row.mime_type ?? null,
    size_bytes: row.size_bytes,
    relative_path: row.relative_path,
    sha256: row.sha256 ?? null,
    created_at: row.created_at,
    deleted_at: row.deleted_at ?? null,
  };
};

// 根据 ID 获取文件
export const getConversationFileById = (id: number): ConversationFile | null => {
  const row = db
    .prepare(
      `SELECT * FROM conversation_files WHERE id = ?`
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToFile(row);
};

// 创建文件记录
export const createConversationFile = (
  input: CreateConversationFileInput,
): ConversationFile => {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO conversation_files(
      user_id, conversation_id, message_id, origin, purpose,
      original_name, stored_name, extension, mime_type,
      size_bytes, relative_path, sha256, created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.userId,
    input.conversationId ?? null,
    input.messageId ?? null,
    input.origin,
    input.purpose,
    input.originalName,
    input.storedName,
    input.extension ?? null,
    input.mimeType ?? null,
    input.sizeBytes,
    input.relativePath,
    input.sha256 ?? null,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getConversationFileById(id)!;
};

// 更新文件记录（用于补充信息，如关联 messageId）
export const updateConversationFile = (
  id: number,
  updates: Partial<Pick<ConversationFile, "message_id" | "conversation_id" | "stored_name" | "relative_path" | "size_bytes" | "sha256">>,
): ConversationFile | null => {
  const existing = getConversationFileById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.message_id !== undefined) {
    fields.push("message_id = ?");
    values.push(updates.message_id);
  }
  if (updates.conversation_id !== undefined) {
    fields.push("conversation_id = ?");
    values.push(updates.conversation_id);
  }
  if (updates.stored_name !== undefined) {
    fields.push("stored_name = ?");
    values.push(updates.stored_name);
  }
  if (updates.relative_path !== undefined) {
    fields.push("relative_path = ?");
    values.push(updates.relative_path);
  }
  if (updates.size_bytes !== undefined) {
    fields.push("size_bytes = ?");
    values.push(updates.size_bytes);
  }
  if (updates.sha256 !== undefined) {
    fields.push("sha256 = ?");
    values.push(updates.sha256);
  }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE conversation_files SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return getConversationFileById(id);
};

// 软删除文件
export const softDeleteConversationFile = (id: number): boolean => {
  const now = new Date().toISOString();
  const result = db
    .prepare(`UPDATE conversation_files SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(now, id);
  return result.changes > 0;
};

// 硬删除文件记录
export const hardDeleteConversationFile = (id: number): boolean => {
  const result = db.prepare(`DELETE FROM conversation_files WHERE id = ?`).run(id);
  return result.changes > 0;
};

// 列出文件
export const listConversationFiles = (
  options: ListConversationFilesOptions = {},
): ConversationFile[] => {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.conversationId !== undefined) {
    conditions.push("conversation_id = ?");
    params.push(options.conversationId);
  }

  if (options.userId !== undefined) {
    conditions.push("user_id = ?");
    params.push(options.userId);
  }

  if (options.purpose !== undefined) {
    conditions.push("purpose = ?");
    params.push(options.purpose);
  }

  if (options.origin !== undefined) {
    conditions.push("origin = ?");
    params.push(options.origin);
  }

  if (!options.includeDeleted) {
    conditions.push("deleted_at IS NULL");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `SELECT * FROM conversation_files ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as any[];

  return rows.map(mapRowToFile);
};

// 根据多个 ID 批量获取文件
export const getConversationFilesByIds = (ids: number[]): ConversationFile[] => {
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM conversation_files WHERE id IN (${placeholders}) AND deleted_at IS NULL`)
    .all(...ids) as any[];

  return rows.map(mapRowToFile);
};

// 统计会话文件数量和大小
export const getConversationFilesStats = (
  conversationId: number,
): { count: number; totalSize: number } => {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size 
       FROM conversation_files 
       WHERE conversation_id = ? AND deleted_at IS NULL`
    )
    .get(conversationId) as any;

  return {
    count: row.count,
    totalSize: row.total_size,
  };
};

// 获取会话的所有文件（用于删除会话时清理文件）
export const getFilesByConversationId = (conversationId: number): ConversationFile[] => {
  const rows = db
    .prepare(`SELECT * FROM conversation_files WHERE conversation_id = ?`)
    .all(conversationId) as any[];
  return rows.map(mapRowToFile);
};

// 硬删除会话的所有文件记录
export const hardDeleteFilesByConversationId = (conversationId: number): number => {
  const result = db
    .prepare(`DELETE FROM conversation_files WHERE conversation_id = ?`)
    .run(conversationId);
  return result.changes;
};
