import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel, type AuthUser } from "../../core/auth/roles.ts";
import { AccessError, assertEntryAccess, listAccessibleLibraries } from "../../core/auth/libraryAccess.ts";
import {
  getTagByIdForUser,
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

const assertOwnTag = (user: AuthUser | undefined, tagId: number): void => {
  if (!user) throw new AccessError("未登录", 401);
  if (!getTagByIdForUser(tagId, user.id)) throw new AccessError("标签不存在", 404);
};

const isEntryAccessible = async (user: AuthUser | undefined, entryId: string): Promise<boolean> => {
  try {
    (await assertEntryAccess(user, entryId));
    return true;
  } catch (error) {
    if (error instanceof AccessError) return false;
    throw error;
  }
};

const sendTagError = (res: express.Response, error: unknown, fallback: string) =>
  res.status(error instanceof AccessError ? error.status : 400)
    .json({ message: error instanceof Error ? error.message : fallback });

// ============================================================================
// 标签 CRUD
// ============================================================================

// 获取当前用户的所有标签（树形结构，带统计信息）
router.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }
    const tags = listAllTagsWithStats(userId, (await listAccessibleLibraries(req.user)).map((library) => library.id));
    return res.json({ tags });
  }
);

// 获取当前用户指定父标签下的子标签
router.get(
  "/children",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }
    
    const { parentId } = req.query as { parentId?: string };
    const parentTagId = parentId ? parseInt(parentId, 10) : null;
    
    if (parentId && (isNaN(parentTagId!) || parentTagId! <= 0)) {
      return res.status(400).json({ message: "父标签 ID 不合法" });
    }
    
    const tags = listChildTags(userId, parentTagId);
    return res.json({ tags });
  }
);

// 获取当前用户的单个标签详情
router.get(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }
    
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const tag = getTagByIdForUser(id, userId);
    if (!tag) {
      return res.status(404).json({ message: "标签不存在" });
    }
    
    return res.json({ tag });
  }
);

// 创建标签（普通用户即可创建自己的标签）
router.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }
    
    const { name, parentTagId, color, allowMultiple, showAncestorChain, sortOrder } = req.body as {
      name?: string;
      parentTagId?: number | null;
      color?: string | null;
      allowMultiple?: boolean;
      showAncestorChain?: boolean;
      sortOrder?: number;
    };
    
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ message: "标签名称不能为空" });
    }
    
    try {
      const tag = createTag({
        userId,
        name: name.trim(),
        parentTagId,
        color,
        allowMultiple,
        showAncestorChain,
        sortOrder,
      });
      return res.status(201).json({ tag });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "创建标签失败" });
    }
  }
);

// 更新标签（用户只能更新自己的标签）
router.put(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }
    
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { name, color, allowMultiple, showAncestorChain, sortOrder } = req.body as {
      name?: string;
      color?: string | null;
      allowMultiple?: boolean;
      showAncestorChain?: boolean;
      sortOrder?: number;
    };
    
    try {
      const tag = updateTag(id, userId, { name, color, allowMultiple, showAncestorChain, sortOrder });
      return res.json({ tag });
    } catch (err: any) {
      return res.status(400).json({ message: err.message || "更新标签失败" });
    }
  }
);

// 删除标签（用户只能删除自己的标签）
router.delete(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "未登录" });
    }
    
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      deleteTag(id, userId);
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
  async (req, res) => {
    const { entryId } = req.params;
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    try {
      (await assertEntryAccess(req.user, entryId));
      const tags = getTagsForEntry(entryId).filter((association) => association.tag.user_id === req.user!.id);
      return res.json({ tags });
    } catch (error) {
      return sendTagError(res, error, "读取标签失败");
    }
  }
);

// 获取标签下的所有文件 ID
router.get(
  "/:id/entries",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      assertOwnTag(req.user, id);
      const { includeChildren, onlyPrimary } = req.query as { includeChildren?: string; onlyPrimary?: string };
      const entryIds: string[] = [];
      for (const entryId of getEntriesForTag(id, includeChildren === "true", onlyPrimary === "true")) {
        if (await isEntryAccessible(req.user, entryId)) entryIds.push(entryId);
      }
      return res.json({ entryIds });
    } catch (error) {
      return sendTagError(res, error, "读取文件标签失败");
    }
  }
);

// 给文件添加标签（普通用户即可）
router.post(
  "/entry/:entryId/add",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const { entryId } = req.params;
    const { tagId, isPrimary } = req.body as { tagId?: number; isPrimary?: boolean };
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    if (typeof tagId !== "number" || !Number.isSafeInteger(tagId) || tagId <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      assertOwnTag(req.user, tagId);
      (await assertEntryAccess(req.user, entryId));
      const entry = addTagToEntry(entryId, tagId, isPrimary === true);
      return res.status(201).json({ entry });
    } catch (err: any) {
      return sendTagError(res, err, "添加标签失败");
    }
  }
);

// 从文件移除标签（普通用户即可）
router.post(
  "/entry/:entryId/remove",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const { entryId } = req.params;
    const { tagId } = req.body as { tagId?: number };
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    if (typeof tagId !== "number" || !Number.isSafeInteger(tagId) || tagId <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      assertOwnTag(req.user, tagId);
      (await assertEntryAccess(req.user, entryId));
      removeTagFromEntry(entryId, tagId);
      return res.status(204).send();
    } catch (error) {
      return sendTagError(res, error, "移除标签失败");
    }
  }
);

// 设置文件的主标签（普通用户即可）
router.post(
  "/entry/:entryId/primary",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const { entryId } = req.params;
    const { tagId } = req.body as { tagId?: number };
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    if (typeof tagId !== "number" || !Number.isSafeInteger(tagId) || tagId <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    try {
      assertOwnTag(req.user, tagId);
      (await assertEntryAccess(req.user, entryId));
      setPrimaryTag(entryId, tagId);
      return res.status(204).send();
    } catch (err: any) {
      return sendTagError(res, err, "设置主标签失败");
    }
  }
);

// 清除文件的主标签（普通用户即可）
router.delete(
  "/entry/:entryId/primary",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const { entryId } = req.params;
    
    if (!entryId) {
      return res.status(400).json({ message: "文件 ID 不能为空" });
    }
    
    try {
      (await assertEntryAccess(req.user, entryId));
      clearPrimaryTag(entryId, req.user!.id);
      return res.status(204).send();
    } catch (error) {
      return sendTagError(res, error, "清除主标签失败");
    }
  }
);

// 批量给文件添加标签（普通用户即可）
router.post(
  "/:id/batch-add",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { entryIds } = req.body as { entryIds?: string[] };
    
    if (!Array.isArray(entryIds) || entryIds.length === 0 || entryIds.some((entryId) => typeof entryId !== "string" || !entryId)) {
      return res.status(400).json({ message: "文件 ID 列表不能为空" });
    }
    
    try {
      assertOwnTag(req.user, id);
      // Validate the whole batch before changing any association.
      for (const entryId of entryIds) (await assertEntryAccess(req.user, entryId));
      addTagToEntries(entryIds, id);
      return res.status(204).send();
    } catch (error) {
      return sendTagError(res, error, "添加标签失败");
    }
  }
);

// 批量从文件移除标签（普通用户即可）
router.post(
  "/:id/batch-remove",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res) => {
    const id = parseInt(req.params.id || "", 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "标签 ID 不合法" });
    }
    
    const { entryIds } = req.body as { entryIds?: string[] };
    
    if (!Array.isArray(entryIds) || entryIds.length === 0 || entryIds.some((entryId) => typeof entryId !== "string" || !entryId)) {
      return res.status(400).json({ message: "文件 ID 列表不能为空" });
    }
    
    try {
      assertOwnTag(req.user, id);
      // Validate the whole batch before changing any association.
      for (const entryId of entryIds) (await assertEntryAccess(req.user, entryId));
      removeTagFromEntries(entryIds, id);
      return res.status(204).send();
    } catch (error) {
      return sendTagError(res, error, "移除标签失败");
    }
  }
);

export { router as tagsRouter };
