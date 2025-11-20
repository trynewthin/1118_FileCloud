import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { listActivityLogs } from "./service.ts";

const router = express.Router();

// 管理员查询操作日志
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { limit, offset, action, actorUserId } = req.query as {
      limit?: string;
      offset?: string;
      action?: string;
      actorUserId?: string;
    };

    const logs = listActivityLogs({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      action: action && action.length > 0 ? action : undefined,
      actorUserId: actorUserId ? Number(actorUserId) : undefined,
    });

    return res.json({ items: logs });
  },
);

export { router as activityLogsRouter };
