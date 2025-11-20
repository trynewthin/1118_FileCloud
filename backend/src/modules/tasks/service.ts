import { db } from "../../core/db/index.ts";

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export interface TaskRecord {
  id: number;
  type: string;
  payload: unknown;
  status: TaskStatus;
  progress: number;
  error_message: string | null;
  created_by_user_id: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

// 将数据库行转换为任务记录
const mapRowToTask = (row: any): TaskRecord => {
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload),
    status: row.status,
    progress: row.progress,
    error_message: row.error_message ?? null,
    created_by_user_id: row.created_by_user_id ?? null,
    started_at: row.started_at ?? null,
    finished_at: row.finished_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

export interface CreateTaskInput {
  type: string;
  payload: unknown;
  createdByUserId?: number | null;
}

// 创建任务，初始状态为 PENDING
export const createTask = (input: CreateTaskInput): TaskRecord => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO tasks(type, payload, status, progress, error_message, created_by_user_id, created_at, updated_at) VALUES(?, ?, 'PENDING', 0, NULL, ?, ?, ?)",
  );

  const result = stmt.run(
    input.type,
    JSON.stringify(input.payload ?? {}),
    input.createdByUserId ?? null,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getTaskById(id)!;
};

// 查询单个任务
export const getTaskById = (id: number): TaskRecord | null => {
  const row = db
    .prepare(
      "SELECT id, type, payload, status, progress, error_message, created_by_user_id, started_at, finished_at, created_at, updated_at FROM tasks WHERE id = ?",
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToTask(row);
};

// 分页查询任务列表（按创建时间倒序）
export const listTasks = (options?: {
  limit?: number;
  offset?: number;
  status?: TaskStatus | "ALL";
}): TaskRecord[] => {
  const limit = options?.limit && options.limit > 0 ? options.limit : 50;
  const offset = options?.offset && options.offset >= 0 ? options.offset : 0;
  const status = options?.status && options.status !== "ALL" ? options.status : null;

  if (status) {
    const rows = db
      .prepare(
        "SELECT id, type, payload, status, progress, error_message, created_by_user_id, started_at, finished_at, created_at, updated_at FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(status, limit, offset) as any[];
    return rows.map(mapRowToTask);
  }

  const rows = db
    .prepare(
      "SELECT id, type, payload, status, progress, error_message, created_by_user_id, started_at, finished_at, created_at, updated_at FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .all(limit, offset) as any[];

  return rows.map(mapRowToTask);
};

// 供执行器使用的状态更新函数
export const updateTaskStatus = (params: {
  id: number;
  status: TaskStatus;
  progress?: number;
  errorMessage?: string | null;
  markStarted?: boolean;
  markFinished?: boolean;
}): TaskRecord | null => {
  const existing = getTaskById(params.id);
  if (!existing) return null;

  const now = new Date().toISOString();

  const nextProgress =
    typeof params.progress === "number" ? params.progress : existing.progress;
  const nextError =
    params.errorMessage !== undefined ? params.errorMessage : existing.error_message;

  const startedAt =
    params.markStarted && !existing.started_at ? now : existing.started_at;
  const finishedAt = params.markFinished ? now : existing.finished_at;

  db.prepare(
    "UPDATE tasks SET status = ?, progress = ?, error_message = ?, started_at = ?, finished_at = ?, updated_at = ? WHERE id = ?",
  ).run(params.status, nextProgress, nextError, startedAt, finishedAt, now, params.id);

  return getTaskById(params.id);
};
