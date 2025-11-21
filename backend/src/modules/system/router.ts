import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { listSystemDirectories, getPathSeparator } from "./service.ts";

const router = express.Router();

// 列出系统目录（仅管理员）
router.get(
  "/fs/list",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
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
