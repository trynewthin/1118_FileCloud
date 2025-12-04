import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import {
  getTagById,
  listAllTags,
  listAllTagsWithStats,
  listChildTags,
  createTag,
  updateTag,
  deleteTag,
  getTagsForEntry,
  getEntriesForTag,
  addTagToEntry,
  removeTagFromEntry,
  setPrimaryTag,
  clearPrimaryTag,
  addTagToEntries,
  removeTagFromEntries,
} from "./service.ts";

const router = express.Router();

// ============================================================================
// 标签 CRUD
// ============================================================================

// 获取所有标签（树形结构，带统计信息）
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (_req, res) => {
    const tags = listAllTagsWithStats();
    return res.json({ tags });
  }
);

// 获取指定父标签下的子标签
router.get(
  "/children",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const { parentId } = req.query as { parentId?: string };
    const parentTagId = parentId ? parseInt(parentId, 10) : null;
    
    if (parentId && (isNaN(parentTagId!) || parentTagId! <= 0)) {
      return res.status(400).json({ message: "父标签 ID 不合法" });
    }
    
    const tags = listChildTags(parentTagId);
    return res.json({ tags });
  }
);

// 获取单个标签详情
router.get(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const tag = getTagById(id);
    if (!tag) {
      return res.status(404).json({ message: "标签不存在" });
    }
    
    return res.json({ tag });
  }
);

// 创建标签（管理员权限）
router.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { name, parentTagId, color, allowMultiple, sortOrder } = req.body as {
      name?: string;
      parentTagId?: number | null;
      color?: string | null;
      allowMultiple?: boolean;
      sortOrder?: number;
    };
    
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "标签名称不能为空" });
    }
    
    try {
      const tag = createTag({
        name: name.trim(),
        parentTagId,
        color,
        allowMultiple,
        sortOrder,
      });
      return res.status(201).json({ tag });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "创建标签失败" });
    }
  }
);

// 更新标签（管理员权限）
router.put(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { name, color, allowMultiple, sortOrder } = req.body as {
      name?: string;
      color?: string | null;
      allowMultiple?: boolean;
      sortOrder?: number;
    };
    
    try {
      const tag = updateTag(id, { name, color, allowMultiple, sortOrder });
      return res.json({ tag });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "更新标签失败" });
    }
  }
);

// 删除标签（管理员权限）
router.delete(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      deleteTag(id);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "删除标签失败" });
    }
  }
);

// ============================================================================
// 文件-标签关联
// ============================================================================

// 获取文件的所有标签
router.get(
  "/entry/:entryId",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const { entryId } = req.params;
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    const tags = getTagsForEntry(entryId);
    return res.json({ tags });
  }
);

// 获取标签下的所有文件 ID
router.get(
  "/:id/entries",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { includeChildren } = req.query as { includeChildren?: string };
    const entryIds = getEntriesForTag(id, includeChildren === "true");
    return res.json({ entryIds });
  }
);

// 给文件添加标签（管理员权限）
router.post(
  "/entry/:entryId/add",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { entryId } = req.params;
    const { tagId, isPrimary } = req.body as { tagId?: number; isPrimary?: boolean };
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    if (!tagId || typeof tagId !== "number" || tagId <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      const entry = addTagToEntry(entryId, tagId, isPrimary ?? false);
      return res.status(201).json({ entry });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "添加标签失败" });
    }
  }
);

// 从文件移除标签（管理员权限）
router.post(
  "/entry/:entryId/remove",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { entryId } = req.params;
    const { tagId } = req.body as { tagId?: number };
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    if (!tagId || typeof tagId !== "number" || tagId <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    removeTagFromEntry(entryId, tagId);
    return res.status(204).send();
  }
);

// 设置文件的主标签（管理员权限）
router.post(
  "/entry/:entryId/primary",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { entryId } = req.params;
    const { tagId } = req.body as { tagId?: number };
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    if (!tagId || typeof tagId !== "number" || tagId <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      setPrimaryTag(entryId, tagId);
      return res.status(204).send();
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "设置主标签失败" });
    }
  }
);

// 清除文件的主标签（管理员权限）
router.delete(
  "/entry/:entryId/primary",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const { entryId } = req.params;
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    clearPrimaryTag(entryId);
    return res.status(204).send();
  }
);

// 批量给文件添加标签（管理员权限）
router.post(
  "/:id/batch-add",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { entryIds } = req.body as { entryIds?: string[] };
    
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ message: "文件 ID 列表不能为空" });
    }
    
    addTagToEntries(entryIds, id);
    return res.status(204).send();
  }
);

// 批量从文件移除标签（管理员权限）
router.post(
  "/:id/batch-remove",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { entryIds } = req.body as { entryIds?: string[] };
    
    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({ message: "文件 ID 列表不能为空" });
    }
    
    removeTagFromEntries(entryIds, id);
    return res.status(204).send();
  }
);

export { router as tagsRouter };
