import { db } from "../../core/db/index.ts";

export interface ActivityLog {
  id: number;
  actor_user_id: number | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: unknown;
  created_at: string;
}

// 写入一条操作日志
export const writeActivityLog = (params: {
  actorUserId?: number | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  detail?: unknown;
}) => {
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO activity_logs(actor_user_id, actor_role, action, target_type, target_id, detail_json, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)",
  ).run(
    params.actorUserId ?? null,
    params.actorRole ?? null,
    params.action,
    params.targetType ?? null,
    params.targetId ?? null,
    params.detail ? JSON.stringify(params.detail) : null,
    now,
  );
};

export interface ListLogsOptions {
  limit?: number;
  offset?: number;
  action?: string;
  actorUserId?: number;
}

// 分页查询操作日志
export const listActivityLogs = (options?: ListLogsOptions): ActivityLog[] => {
  const limit = options?.limit && options.limit > 0 ? options.limit : 50;
  const offset = options?.offset && options.offset >= 0 ? options.offset : 0;

  const filters: string[] = [];
  const params: any[] = [];

  if (options?.action) {
    filters.push("action = ?");
    params.push(options.action);
  }

  if (options?.actorUserId !== undefined) {
    filters.push("actor_user_id = ?");
    params.push(options.actorUserId);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT id, actor_user_id, actor_role, action, target_type, target_id, detail_json, created_at FROM activity_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as any[];

  return rows.map((row) => ({
    id: row.id,
    actor_user_id: row.actor_user_id ?? null,
    actor_role: row.actor_role ?? null,
    action: row.action,
    target_type: row.target_type ?? null,
    target_id: row.target_id ?? null,
    detail: row.detail_json ? JSON.parse(row.detail_json) : null,
    created_at: row.created_at,
  }));
};
