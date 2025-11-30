import { db } from "../../core/db/index.ts";

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

// 详细进度信息，用于显示如 "1000/8889" 的进度
export interface DetailProgress {
  current: number;
  total: number;
  label?: string; // 可选的进度标签，如 "生成缩略图"
}

export interface TaskRecord {
  id: number;
  parent_task_id: number | null;
  type: string;
  payload: unknown;
  status: TaskStatus;
  progress: number;
  detail_progress: DetailProgress | null;
  error_message: string | null;
  created_by_user_id: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  // 仅在查询时填充的子任务列表
  children?: TaskRecord[];
}

// 将数据库行转换为任务记录
const mapRowToTask = (row: any): TaskRecord => {
  let detailProgress: DetailProgress | null = null;
  if (row.detail_progress) {
    try {
      detailProgress = JSON.parse(row.detail_progress);
    } catch {
      detailProgress = null;
    }
  }

  return {
    id: row.id,
    parent_task_id: row.parent_task_id ?? null,
    type: row.type,
    payload: JSON.parse(row.payload),
    status: row.status,
    progress: row.progress,
    detail_progress: detailProgress,
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
  parentTaskId?: number | null;
  createdByUserId?: number | null;
}

// 创建任务，初始状态为 PENDING
export const createTask = (input: CreateTaskInput): TaskRecord => {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO tasks(parent_task_id, type, payload, status, progress, detail_progress, error_message, created_by_user_id, created_at, updated_at) VALUES(?, ?, ?, 'PENDING', 0, NULL, NULL, ?, ?, ?)",
  );

  const result = stmt.run(
    input.parentTaskId ?? null,
    input.type,
    JSON.stringify(input.payload ?? {}),
    input.createdByUserId ?? null,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  return getTaskById(id)!;
};

// 所有字段的 SELECT 语句
const TASK_SELECT_FIELDS = "id, parent_task_id, type, payload, status, progress, detail_progress, error_message, created_by_user_id, started_at, finished_at, created_at, updated_at";

// 查询单个任务
export const getTaskById = (id: number): TaskRecord | null => {
  const row = db
    .prepare(
      `SELECT ${TASK_SELECT_FIELDS} FROM tasks WHERE id = ?`,
    )
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToTask(row);
};

// 查询任务的所有子任务
export const getChildTasks = (parentTaskId: number): TaskRecord[] => {
  const rows = db
    .prepare(
      `SELECT ${TASK_SELECT_FIELDS} FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC`,
    )
    .all(parentTaskId) as any[];
  return rows.map(mapRowToTask);
};

// 查询任务并附带子任务
export const getTaskWithChildren = (id: number): TaskRecord | null => {
  const task = getTaskById(id);
  if (!task) return null;
  task.children = getChildTasks(id);
  return task;
};

// 分页查询任务列表（按创建时间倒序，默认只查询顶级任务）
export const listTasks = (options?: {
  limit?: number;
  offset?: number;
  status?: TaskStatus | "ALL";
  includeChildren?: boolean; // 是否包含子任务
  onlyTopLevel?: boolean; // 是否只查询顶级任务（无父任务）
}): TaskRecord[] => {
  const limit = options?.limit && options.limit > 0 ? options.limit : 50;
  const offset = options?.offset && options.offset >= 0 ? options.offset : 0;
  const status = options?.status && options.status !== "ALL" ? options.status : null;
  const onlyTopLevel = options?.onlyTopLevel ?? true; // 默认只查询顶级任务
  const includeChildren = options?.includeChildren ?? false;

  let whereClause = "";
  const params: any[] = [];

  // 构建 WHERE 子句
  const conditions: string[] = [];
  if (onlyTopLevel) {
    conditions.push("parent_task_id IS NULL");
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (conditions.length > 0) {
    whereClause = "WHERE " + conditions.join(" AND ");
  }

  params.push(limit, offset);

  const rows = db
    .prepare(
      `SELECT ${TASK_SELECT_FIELDS} FROM tasks ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params) as any[];

  const tasks = rows.map(mapRowToTask);

  // 如果需要包含子任务，为每个任务查询其子任务
  if (includeChildren) {
    for (const task of tasks) {
      task.children = getChildTasks(task.id);
    }
  }

  return tasks;
};

// 统计子任务进度，用于计算父任务的整体进度
export const calculateChildrenProgress = (parentTaskId: number): {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  overallProgress: number;
} => {
  const children = getChildTasks(parentTaskId);
  const total = children.length;
  if (total === 0) {
    return { total: 0, completed: 0, failed: 0, running: 0, pending: 0, overallProgress: 100 };
  }

  let completed = 0;
  let failed = 0;
  let running = 0;
  let pending = 0;
  let progressSum = 0;

  for (const child of children) {
    switch (child.status) {
      case "SUCCESS":
        completed++;
        progressSum += 100;
        break;
      case "FAILED":
        failed++;
        progressSum += 100; // 失败也算完成
        break;
      case "RUNNING":
        running++;
        progressSum += child.progress;
        break;
      case "PENDING":
        pending++;
        break;
    }
  }

  const overallProgress = Math.round(progressSum / total);
  return { total, completed, failed, running, pending, overallProgress };
};

// 供执行器使用的状态更新函数
export const updateTaskStatus = (params: {
  id: number;
  status: TaskStatus;
  progress?: number;
  detailProgress?: DetailProgress | null;
  errorMessage?: string | null;
  markStarted?: boolean;
  markFinished?: boolean;
}): TaskRecord | null => {
  const existing = getTaskById(params.id);
  if (!existing) return null;

  const now = new Date().toISOString();

  const nextProgress =
    typeof params.progress === "number" ? params.progress : existing.progress;
  const nextDetailProgress =
    params.detailProgress !== undefined
      ? (params.detailProgress ? JSON.stringify(params.detailProgress) : null)
      : (existing.detail_progress ? JSON.stringify(existing.detail_progress) : null);
  const nextError =
    params.errorMessage !== undefined ? params.errorMessage : existing.error_message;

  const startedAt =
    params.markStarted && !existing.started_at ? now : existing.started_at;
  const finishedAt = params.markFinished ? now : existing.finished_at;

  db.prepare(
    "UPDATE tasks SET status = ?, progress = ?, detail_progress = ?, error_message = ?, started_at = ?, finished_at = ?, updated_at = ? WHERE id = ?",
  ).run(params.status, nextProgress, nextDetailProgress, nextError, startedAt, finishedAt, now, params.id);

  return getTaskById(params.id);
};

// 快捷更新详细进度（不改变状态）
export const updateTaskDetailProgress = (
  id: number,
  detailProgress: DetailProgress,
): TaskRecord | null => {
  const existing = getTaskById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const detailProgressJson = JSON.stringify(detailProgress);

  // 根据详细进度计算百分比
  const progress = detailProgress.total > 0
    ? Math.round((detailProgress.current / detailProgress.total) * 100)
    : 0;

  db.prepare(
    "UPDATE tasks SET progress = ?, detail_progress = ?, updated_at = ? WHERE id = ?",
  ).run(progress, detailProgressJson, now, id);

  return getTaskById(id);
};

/**
 * 删除/取消任务
 * - PENDING 状态：直接删除
 * - RUNNING 状态：标记为 FAILED 并设置错误信息为"已取消"
 * - SUCCESS/FAILED 状态：直接删除记录
 */
export const deleteTask = (id: number): { ok: boolean; message?: string } => {
  const task = getTaskById(id);
  if (!task) {
    return { ok: false, message: "任务不存在" };
  }

  // 如果任务正在运行，标记为失败（取消）
  if (task.status === "RUNNING") {
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE tasks SET status = 'FAILED', error_message = '用户取消', finished_at = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, id);
    return { ok: true };
  }

  // 其他状态直接删除
  // 先删除子任务
  db.prepare("DELETE FROM tasks WHERE parent_task_id = ?").run(id);
  // 再删除主任务
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  return { ok: true };
};
