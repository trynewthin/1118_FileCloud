import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { getFsAccessKey } from "../../core/config/paths.ts";
import { listSystemDirectories, getPathSeparator } from "./service.ts";

const router = express.Router();

// 查询是否需要目录访问密钥
router.get(
  "/fs/require-key",
  authenticate,
  requirePermission(PermissionLevel.User),
  (_req, res) => {
    const key = getFsAccessKey();
    return res.json({ required: key.length > 0 });
  }
);

// 列出系统目录（登录用户可访问，用于选择文件库路径）
router.get(
  "/fs/list",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    // 检查是否需要密钥验证
    const configuredKey = getFsAccessKey();
    if (configuredKey.length > 0) {
      const providedKey = req.headers["x-fs-access-key"] as string | undefined;
      if (!providedKey || providedKey !== configuredKey) {
        return res.status(403).json({ message: "目录访问密钥错误" });
      }
    }

    const dirPath = req.query.path as string | undefined;
    try {
      const items = listSystemDirectories(dirPath);
      return res.json({ 
        items, 
        separator: getPathSeparator(),
        currentPath: dirPath // 如果没传则是默认路径
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "读取目录失败" });
    }
  }
);

export { router as systemRouter };
