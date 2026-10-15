import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel, type AuthUser } from "../../core/auth/roles.ts";
import { AccessError, assertEntryAccess, assertLibraryAccess } from "../../core/auth/libraryAccess.ts";
import type { TaskRecord } from "../../core/tasks/types.ts";
import { createTask, getTaskWithChildren, listTasks, deleteTask } from "./service.ts";

const router = express.Router();

// Task payloads and error details can contain private file names and paths.
const canReadTask = async (user: AuthUser | undefined, task: TaskRecord): Promise<boolean> => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (task.created_by_user_id !== user.id) return false;
  const payload = task.payload as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const fields = payload as Record<string, unknown>;
  try {
    if (fields.libraryId !== undefined) (await assertLibraryAccess(user, fields.libraryId));
    for (const key of ["entryId", "targetParentId"]) {
      if (fields[key] !== undefined && fields[key] !== null) {
        (await assertEntryAccess(user, fields[key], { includeDeleted: true }));
      }
    }
    return true;
  } catch (error) {
    if (error instanceof AccessError) return false;
    throw error;
  }
};

const filterTaskChildren = async (user: AuthUser | undefined, task: TaskRecord): Promise<TaskRecord> => {
  if (!task.children) return task;
  const children: TaskRecord[] = [];
  for (const child of task.children) {
    if (await canReadTask(user, child)) children.push(await filterTaskChildren(user, child));
  }
  return { ...task, children };
};

// 查询任务列表（用户可见，用于展示任务队列和进度）
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const { limit, offset, status, includeChildren } = req.query as {
      limit?: string;
      offset?: string;
      status?: string;
      includeChildren?: string;
    };

    const parsedLimit = limit === undefined ? 50 : Number(limit);
    const parsedOffset = offset === undefined ? 0 : Number(offset);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500 ||
        !Number.isSafeInteger(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ message: "分页参数不合法" });
    }
    const normalizedStatus =
      status === "PENDING" ||
      status === "RUNNING" ||
      status === "SUCCESS" ||
      status === "FAILED"
        ? status
        : "ALL";

    const candidates = listTasks({
      limit: parsedLimit,
      offset: parsedOffset,
      status: normalizedStatus,
      includeChildren: includeChildren === "true",
      createdByUserId: req.user?.role === "admin" ? undefined : req.user?.id,
    });
    const tasks: TaskRecord[] = [];
    for (const task of candidates) {
      if (await canReadTask(req.user, task)) tasks.push(await filterTaskChildren(req.user, task));
    }

    return res.json({ items: tasks });
  },
);

// 查询单个任务详情（用户可见，包含子任务）
router.get(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "任务 ID 不合法" });
    }

    const task = getTaskWithChildren(id);
    if (!task || !(await canReadTask(req.user, task))) {
      return res.status(404).json({ message: "任务不存在" });
    }

    return res.json({ task: await filterTaskChildren(req.user, task) });
  },
);

// 创建任务接口（主要面向服务/管理员，用户通常不直接调用）
router.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { type, payload } = req.body as {
      type?: string;
      payload?: unknown;
    };

    if (!type || typeof type !== "string") {
      return res.status(400).json({ message: "任务类型不能为空" });
    }

    const userId = req.user?.id ?? null;

    const task = createTask({
      type,
      payload: payload ?? {},
      createdByUserId: userId,
    });

    return res.status(201).json({ task });
  },
);

// 删除/取消任务（管理员权限）
router.delete(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "任务 ID 不合法" });
    }

    const result = deleteTask(id);
    if (!result.ok) {
      return res.status(404).json({ message: result.message });
    }

    return res.status(204).send();
  },
);

export { router as tasksRouter };
