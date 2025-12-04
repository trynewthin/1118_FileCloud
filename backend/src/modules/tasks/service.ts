/**
 * 任务服务层（重构版）
 * 
 * 职责：
 * 1. 任务的 CRUD 操作
 * 2. 与数据库交互
 * 3. 为执行器提供接口
 */

import { db } from "../../core/db/index.ts";
import { notifyTaskCreated } from "../../core/tasks/executor.ts";
import {
  type TaskStatus,
  type TaskType,
  type TaskPriority,
  type TaskRecord,
  type TaskPayload,
  type DetailProgress,
  type TaskDescriptor,
  TaskPriorities,
  TaskTypeToDefaultPriority,
  generateTaskDescriptor,
  DEFAULT_EXECUTOR_CONFIG,
} from "../../core/tasks/types.ts";

// ============================================================================
// 数据库行映射
// ============================================================================

const TASK_SELECT_FIELDS = `
  id, parent_task_id, type, payload, status, priority, 
  progress, detail_progress, error_message, 
  retry_count, max_retries,
  created_by_user_id, started_at, finished_at, created_at, updated_at
`;

const mapRowToTask = (row: any): TaskRecord => {
  let detailProgress: DetailProgress | null = null;
  if (row.detail_progress) {
    try {
      detailProgress = JSON.parse(row.detail_progress);
    } catch {
      detailProgress = null;
    }
  }

  const task: TaskRecord = {
    id: row.id,
    parent_task_id: row.parent_task_id ?? null,
    type: row.type as TaskType,
    payload: JSON.parse(row.payload),
    status: row.status as TaskStatus,
    priority: row.priority ?? TaskPriorities.NORMAL,
    progress: row.progress ?? 0,
    detail_progress: detailProgress,
    error_message: row.error_message ?? null,
    retry_count: row.retry_count ?? 0,
    max_retries: row.max_retries ?? DEFAULT_EXECUTOR_CONFIG.defaultMaxRetries,
    created_by_user_id: row.created_by_user_id ?? null,
    started_at: row.started_at ?? null,
    finished_at: row.finished_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  // 附加描述符
  task.descriptor = generateTaskDescriptor(task.type, task.payload);

  return task;
};

// ============================================================================
// 查询接口
// ============================================================================

export const getTaskById = (id: number): TaskRecord | null => {
  const row = db
    .prepare(`SELECT ${TASK_SELECT_FIELDS} FROM tasks WHERE id = ?`)
    .get(id) as any | undefined;

  if (!row) return null;
  return mapRowToTask(row);
};

export const getChildTasks = (parentTaskId: number): TaskRecord[] => {
  const rows = db
    .prepare(`SELECT ${TASK_SELECT_FIELDS} FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC`)
    .all(parentTaskId) as any[];
  return rows.map(mapRowToTask);
};

export const getTaskWithChildren = (id: number): TaskRecord | null => {
  const task = getTaskById(id);
  if (!task) return null;
  task.children = getChildTasks(id);
  return task;
};

/**
 * 获取待执行的任务（供执行器调用）
 * 按优先级降序、创建时间升序排列
 */
export const listPendingTasks = (limit: number): TaskRecord[] => {
  const rows = db
    .prepare(`
      SELECT ${TASK_SELECT_FIELDS} 
      FROM tasks 
      WHERE status = 'PENDING' 
      ORDER BY priority DESC, created_at ASC 
      LIMIT ?
    `)
    .all(limit) as any[];
  return rows.map(mapRowToTask);
};

/**
 * 分页查询任务列表
 */
export const listTasks = (options?: {
  limit?: number;
  offset?: number;
  status?: TaskStatus | "ALL";
  type?: TaskType;
  includeChildren?: boolean;
  onlyTopLevel?: boolean;
}): TaskRecord[] => {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const status = options?.status !== "ALL" ? options?.status : null;
  const type = options?.type ?? null;
  const onlyTopLevel = options?.onlyTopLevel ?? true;
  const includeChildren = options?.includeChildren ?? false;

  const conditions: string[] = [];
  const params: any[] = [];

  if (onlyTopLevel) {
    conditions.push("parent_task_id IS NULL");
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  params.push(limit, offset);

  const rows = db
    .prepare(`
      SELECT ${TASK_SELECT_FIELDS} 
      FROM tasks 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `)
    .all(...params) as any[];

  const tasks = rows.map(mapRowToTask);

  if (includeChildren) {
    for (const task of tasks) {
      task.children = getChildTasks(task.id);
    }
  }

  return tasks;
};

// ============================================================================
// 创建接口
// ============================================================================

export interface CreateTaskInput {
  type: TaskType | string;
  payload: TaskPayload | unknown;
  parentTaskId?: number | null;
  createdByUserId?: number | null;
  priority?: TaskPriority;
  maxRetries?: number;
}

export const createTask = (input: CreateTaskInput): TaskRecord => {
  const now = new Date().toISOString();
  const priority = input.priority ?? TaskTypeToDefaultPriority[input.type as TaskType] ?? TaskPriorities.NORMAL;
  const maxRetries = input.maxRetries ?? DEFAULT_EXECUTOR_CONFIG.defaultMaxRetries;

  const stmt = db.prepare(`
    INSERT INTO tasks(
      parent_task_id, type, payload, status, priority,
      progress, detail_progress, error_message,
      retry_count, max_retries,
      created_by_user_id, created_at, updated_at
    ) VALUES(?, ?, ?, 'PENDING', ?, 0, NULL, NULL, 0, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.parentTaskId ?? null,
    input.type,
    JSON.stringify(input.payload ?? {}),
    priority,
    maxRetries,
    input.createdByUserId ?? null,
    now,
    now,
  );

  const id = Number(result.lastInsertRowid);
  const task = getTaskById(id)!;

  // 通知执行器有新任务
  notifyTaskCreated();

  return task;
};

// ============================================================================
// 更新接口
// ============================================================================

export const updateTaskStatus = (params: {
  id: number;
  status: TaskStatus | string;
  progress?: number;
  detailProgress?: DetailProgress | null;
  errorMessage?: string | null;
  markStarted?: boolean;
  markFinished?: boolean;
}): TaskRecord | null => {
  const existing = getTaskById(params.id);
  if (!existing) return null;

  const now = new Date().toISOString();

  const nextProgress = typeof params.progress === "number" ? params.progress : existing.progress;
  const nextDetailProgress = params.detailProgress !== undefined
    ? (params.detailProgress ? JSON.stringify(params.detailProgress) : null)
    : (existing.detail_progress ? JSON.stringify(existing.detail_progress) : null);
  const nextError = params.errorMessage !== undefined ? params.errorMessage : existing.error_message;

  const startedAt = params.markStarted && !existing.started_at ? now : existing.started_at;
  const finishedAt = params.markFinished ? now : existing.finished_at;

  db.prepare(`
    UPDATE tasks SET 
      status = ?, progress = ?, detail_progress = ?, error_message = ?,
      started_at = ?, finished_at = ?, updated_at = ?
    WHERE id = ?
  `).run(params.status, nextProgress, nextDetailProgress, nextError, startedAt, finishedAt, now, params.id);

  return getTaskById(params.id);
};

export const incrementRetryCount = (id: number): void => {
  const now = new Date().toISOString();
  db.prepare("UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE id = ?").run(now, id);
};

/**
 * 快捷更新详细进度（不改变状态）
 * 兼容旧版 API
 */
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
 * 重置所有 RUNNING 状态的任务为 PENDING（崩溃恢复）
 */
export const resetRunningTasks = (): number => {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE tasks SET status = 'PENDING', updated_at = ? WHERE status = 'RUNNING'
  `).run(now);
  return result.changes;
};

// ============================================================================
// 删除接口
// ============================================================================

export const deleteTask = (id: number): { ok: boolean; message?: string } => {
  const task = getTaskById(id);
  if (!task) {
    return { ok: false, message: "任务不存在" };
  }

  if (task.status === "RUNNING") {
    // 正在运行的任务标记为取消
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE tasks SET status = 'CANCELLED', error_message = '用户取消', finished_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, id);
    return { ok: true };
  }

  // 先删除子任务
  db.prepare("DELETE FROM tasks WHERE parent_task_id = ?").run(id);
  // 再删除主任务
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

  return { ok: true };
};

// ============================================================================
// 统计接口
// ============================================================================

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
      case "CANCELLED":
        failed++;
        progressSum += 100;
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

export const getTaskStats = (): {
  pending: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
} => {
  const row = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'RUNNING' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
    FROM tasks
  `).get() as any;

  return {
    pending: row.pending ?? 0,
    running: row.running ?? 0,
    success: row.success ?? 0,
    failed: row.failed ?? 0,
    cancelled: row.cancelled ?? 0,
  };
};

// 导出类型
export type { TaskStatus, TaskRecord, DetailProgress } from "../../core/tasks/types.ts";
