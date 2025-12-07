import express from "express";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import {
  listFileLibraries,
  createFileLibrary,
  updateFileLibrary,
  deleteFileLibrary,
  refreshFileLibraryStatus,
  getFileLibraryById,
  getFileLibraryStats,
} from "./service.ts";

const router = express.Router();

// 列出所有文件库（查询类接口，普通登录用户即可访问）
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (_req, res) => {
    const libraries = listFileLibraries();
    return res.json({ items: libraries });
  },
);

// 创建文件库
router.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { rootPath, displayName, capacityLimitBytes } = req.body as {
      rootPath?: string;
      displayName?: string;
      capacityLimitBytes?: number | null;
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

    try {
      const lib = createFileLibrary({
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

// 更新文件库配置
router.patch(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
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

// 删除文件库配置（不会删除真实目录）
router.delete(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "文件库 ID 不合法" });
    }

    const existing = getFileLibraryById(id);
    if (!existing) {
      return res.status(404).json({ message: "文件库不存在" });
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

    const stats = getFileLibraryStats(id);
    if (!stats) {
      return res.status(404).json({ message: "文件库不存在" });
    }

    return res.json({ stats });
  },
);

export { router as fileLibrariesRouter };
