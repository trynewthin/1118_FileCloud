import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { createTask, getTaskById, listTasks } from "./service.ts";

const router = express.Router();

// 查询任务列表（用户可见，用于展示任务队列和进度）
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const { limit, offset, status } = req.query as {
      limit?: string;
      offset?: string;
      status?: string;
    };

    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const normalizedStatus =
      status === "PENDING" ||
      status === "RUNNING" ||
      status === "SUCCESS" ||
      status === "FAILED"
        ? status
        : "ALL";

    const tasks = listTasks({
      limit: parsedLimit,
      offset: parsedOffset,
      status: normalizedStatus,
    });

    return res.json({ items: tasks });
  },
);

// 查询单个任务详情（用户可见）
router.get(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "任务 ID 不合法" });
    }

    const task = getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: "任务不存在" });
    }

    return res.json({ task });
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

export { router as tasksRouter };
