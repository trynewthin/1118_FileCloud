import express from "express";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import {
  listFileLibraries,
  listAllFileLibraries,
  createFileLibrary,
  updateFileLibrary,
  deleteFileLibrary,
  refreshFileLibraryStatus,
  getFileLibraryById,
  getFileLibraryStats,
} from "./service.ts";

const router = express.Router();

// 列出当前用户的文件库
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const userId = req.user!.id;
    const libraries = listFileLibraries(userId);
    return res.json({ items: libraries });
  },
);

// 列出所有文件库（管理员用）
router.get(
  "/all",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (_req, res) => {
    const libraries = listAllFileLibraries();
    return res.json({ items: libraries });
  },
);

// 创建文件库（管理员可为任意用户创建，普通用户只能为自己创建）
router.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const { rootPath, displayName, capacityLimitBytes, userId: targetUserId } = req.body as {
      rootPath?: string;
      displayName?: string;
      capacityLimitBytes?: number | null;
      userId?: number;
    };

    if (!rootPath || typeof rootPath !== "string") {
      return res.status(400).json({ message: "文件库路径不能为空" });
    }

    if (
      capacityLimitBytes !== undefined &&
      capacityLimitBytes !== null &&
      (typeof capacityLimitBytes !== "number" || capacityLimitBytes < 0)
    ) {
      return res
        .status(400)
        .json({ message: "容量限制必须为非负整数或为空" });
    }

    // 确定文件库归属用户
    let ownerId = req.user!.id;
    if (targetUserId !== undefined && targetUserId !== req.user!.id) {
      // 只有管理员可以为其他用户创建文件库
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "无权为其他用户创建文件库" });
      }
      ownerId = targetUserId;
    }

    try {
      const lib = createFileLibrary({
        userId: ownerId,
        rootPath,
        displayName,
        capacityLimitBytes: capacityLimitBytes ?? null,
      });
      return res.status(201).json({ library: lib });
    } catch (err: any) {
      if (typeof err?.message === "string" && err.message.includes("UNIQUE")) {
        return res.status(409).json({ message: "该路径的文件库已存在" });
      }
      return res.status(500).json({ message: "创建文件库失败" });
    }
  },
);

// 更新文件库配置（用户只能修改自己的文件库，管理员可修改任意文件库）
router.patch(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    // 检查文件库是否存在以及权限
    const existing = getFileLibraryById(id);
    if (!existing) {
      return res.status(404).json({ message: "文件库不存在" });
    }
    if (existing.user_id !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ message: "无权修改此文件库" });
    }

    const { displayName, capacityLimitBytes, isEnabled } = req.body as {
      displayName?: string;
      capacityLimitBytes?: number | null;
      isEnabled?: boolean;
    };

    if (
      capacityLimitBytes !== undefined &&
      capacityLimitBytes !== null &&
      (typeof capacityLimitBytes !== "number" || capacityLimitBytes < 0)
    ) {
      return res
        .status(400)
        .json({ message: "容量限制必须为非负整数或为空" });
    }

    const updated = updateFileLibrary(id, {
      displayName,
      capacityLimitBytes: capacityLimitBytes ?? null,
      isEnabled,
    });

    if (!updated) {
      return res.status(404).json({ message: "文件库不存在" });
    }

    return res.json({ library: updated });
  },
);

// 删除文件库配置（用户只能删除自己的文件库，管理员可删除任意文件库）
router.delete(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const existing = getFileLibraryById(id);
    if (!existing) {
      return res.status(404).json({ message: "文件库不存在" });
    }

    // 检查权限
    if (existing.user_id !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ message: "无权删除此文件库" });
    }

    const ok = deleteFileLibrary(id);
    if (!ok) {
      return res.status(500).json({ message: "删除文件库失败" });
    }

    return res.status(204).send();
  },
);

// 刷新指定文件库的容量和在线状态
router.post(
  "/:id/refresh",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    // 检查文件库是否存在以及权限
    const existing = getFileLibraryById(id);
    if (!existing) {
      return res.status(404).json({ message: "文件库不存在" });
    }
    if (existing.user_id !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ message: "无权操作此文件库" });
    }

    const lib = refreshFileLibraryStatus(id);
    if (!lib) {
      return res.status(404).json({ message: "文件库不存在" });
    }

    return res.json({ library: lib });
  },
);

// 获取指定文件库的统计信息（文件数量、大小等）
router.get(
  "/:id/stats",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    // 检查文件库是否存在以及权限
    const existing = getFileLibraryById(id);
    if (!existing) {
      return res.status(404).json({ message: "文件库不存在" });
    }
    if (existing.user_id !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ message: "无权查看此文件库" });
    }

    const stats = getFileLibraryStats(id);
    if (!stats) {
      return res.status(404).json({ message: "文件库不存在" });
    }

    return res.json({ stats });
  },
);

export { router as fileLibrariesRouter };
