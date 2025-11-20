import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { listSettings, setSetting } from "./service.ts";

const router = express.Router();

// 管理员查看所有系统设置
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const items = listSettings();
    return res.json({ items });
  },
);

// 管理员更新单个设置值
router.put(
  "/:key",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { key } = req.params;
    if (!key || typeof key !== "string") {
      return res.status(400).json({ message: "设置键不合法" });
    }

    const { value } = req.body as { value?: string | number | boolean };

    if (value === undefined || value === null) {
      return res.status(400).json({ message: "设置值不能为空" });
    }

    // 统一以字符串形式存储
    setSetting(key, String(value));

    return res.status(204).send();
  },
);

export { router as settingsRouter };
