// ============================================================================
// AI 会话文件服务 - API 路由
// ============================================================================

import express from "express";
import path from "node:path";
import Busboy from "busboy";
import { PermissionLevel } from "../../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../../core/auth/permission.ts";
import { createLogger } from "../../../core/logger/index.ts";
import {
  uploadFile,
  getFileById,
  getFilesByIds,
  listFiles,
  getFileReadStream,
  canUserAccessFile,
  mapFileToInfo,
  mapFilesToInfos,
} from "./service.ts";
import type { ConversationFilePurpose } from "./types.ts";

const router = express.Router();
const logger = createLogger("AI/ConversationFiles");

// 允许上传的 MIME 类型白名单
const ALLOWED_UPLOAD_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "text/plain",
  "text/markdown",
  "application/json",
]);

// 单文件最大大小（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ============================================================================
// 上传文件
// POST /ai/files
// ============================================================================
router.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const userId = req.user.id;
    const uploads: Array<{
      id: number;
      originalName: string;
      mimeType: string | null;
      sizeBytes: number;
      purpose: string;
    }> = [];

    try {
      const busboy = Busboy({ headers: req.headers });

      // 从 query 或 body 获取 conversationId
      let conversationId: number | null = null;
      busboy.on("field", (name, value) => {
        if (name === "conversationId") {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && parsed > 0) {
            conversationId = parsed;
          }
        }
      });

      busboy.on("file", (fieldname, file, info) => {
        const { filename, mimeType } = info;

        // 检查 MIME 类型
        if (!ALLOWED_UPLOAD_MIMES.has(mimeType)) {
          logger.warn(`拒绝上传不支持的文件类型: ${mimeType}`);
          file.resume();
          return;
        }

        const chunks: Buffer[] = [];
        let totalSize = 0;
        let truncated = false;

        file.on("data", (chunk) => {
          totalSize += chunk.length;
          if (totalSize > MAX_FILE_SIZE) {
            truncated = true;
            file.resume(); // 跳过剩余数据
            return;
          }
          chunks.push(chunk);
        });
        file.on("end", () => {
          if (truncated) {
            logger.warn(`文件超过大小限制: ${filename}`);
            return;
          }

          const buffer = Buffer.concat(chunks);

          try {
            const result = uploadFile({
              userId,
              conversationId,
              originalName: filename,
              mimeType,
              buffer,
            });

            uploads.push({
              id: result.file.id,
              originalName: result.file.original_name,
              mimeType: result.file.mime_type,
              sizeBytes: result.file.size_bytes,
              purpose: result.file.purpose,
            });
          } catch (err: any) {
            logger.error(`保存文件失败: ${err.message}`);
          }
        });
      });

      busboy.on("finish", () => {
        res.json({ uploads });
      });

      busboy.on("error", (err) => {
        logger.error(`上传处理错误: ${err}`);
        res.status(500).json({ message: "上传处理失败" });
      });

      req.pipe(busboy);
    } catch (err: any) {
      logger.error(`上传错误: ${err}`);
      res.status(500).json({ message: "上传失败" });
    }
  },
);

// ============================================================================
// 获取文件元信息
// GET /ai/files/:id
// ============================================================================
router.get(
  "/:id",
  async (req, res, next) => {
    // 支持 token 查询参数认证（用于 img src）
    const tokenFromQuery = req.query.token as string | undefined;
    if (tokenFromQuery && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${tokenFromQuery}`;
    }
    next();
  },
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const fileId = parseInt(req.params.id ?? "", 10);
    if (isNaN(fileId) || fileId <= 0) {
      return res.status(400).json({ message: "无效的文件 ID" });
    }

    const file = getFileById(fileId);
    if (!file) {
      return res.status(404).json({ message: "文件不存在" });
    }

    if (!canUserAccessFile(file, req.user.id)) {
      return res.status(403).json({ message: "无权访问该文件" });
    }

    const info = mapFileToInfo(file);
    // 添加 URL
    info.contentUrl = `/api/ai/files/${file.id}/content`;

    return res.json({ file: info });
  },
);

// ============================================================================
// 获取文件内容（预览/下载）
// GET /ai/files/:id/content
// ============================================================================
router.get(
  "/:id/content",
  async (req, res, next) => {
    // 支持 token 查询参数认证（用于 img src）
    const tokenFromQuery = req.query.token as string | undefined;
    if (tokenFromQuery && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${tokenFromQuery}`;
    }
    next();
  },
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const fileId = parseInt(req.params.id ?? "", 10);
    if (isNaN(fileId) || fileId <= 0) {
      return res.status(400).json({ message: "无效的文件 ID" });
    }

    try {
      const file = getFileById(fileId);
      if (!file) {
        return res.status(404).json({ message: "文件不存在" });
      }

      if (!canUserAccessFile(file, req.user.id)) {
        return res.status(403).json({ message: "无权访问该文件" });
      }

      // 处理 disposition 参数
      const disposition = req.query.disposition as string | undefined;
      const isDownload = disposition === "attachment";

      // 设置响应头
      const contentType = file.mime_type || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", file.size_bytes);

      if (isDownload) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(file.original_name)}"`,
        );
      } else {
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${encodeURIComponent(file.original_name)}"`,
        );
      }

      // 缓存策略：私有缓存，1 年
      res.setHeader("Cache-Control", "private, max-age=31536000");

      // 流式输出
      const stream = getFileReadStream(file);
      stream.pipe(res);
    } catch (err: any) {
      logger.error(`获取文件内容失败: ${err.message}`);
      return res.status(500).json({ message: "获取文件失败" });
    }
  },
);

// ============================================================================
// 列出会话文件
// GET /ai/conversations/:conversationId/files
// ============================================================================
router.get(
  "/conversations/:conversationId/files",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const conversationId = parseInt(req.params.conversationId ?? "", 10);
    if (isNaN(conversationId) || conversationId <= 0) {
      return res.status(400).json({ message: "无效的会话 ID" });
    }

    const purpose = req.query.purpose as ConversationFilePurpose | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const files = listFiles({
      conversationId,
      userId: req.user.id, // 只能查看自己的文件
      purpose,
      limit,
      offset,
    });

    const items = mapFilesToInfos(files).map((info) => ({
      ...info,
      contentUrl: `/api/ai/files/${info.id}/content`,
    }));

    return res.json({ items });
  },
);

// ============================================================================
// 批量获取文件信息（用于消息附件回放）
// POST /ai/files/batch
// ============================================================================
router.post(
  "/batch",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "未登录" });
    }

    const { ids } = req.body as { ids?: number[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "缺少文件 ID 列表" });
    }

    // 限制批量查询数量
    const validIds = ids.filter((id) => Number.isInteger(id) && id > 0).slice(0, 50);

    const files = getFilesByIds(validIds);

    // 只返回用户有权访问的文件
    const accessibleFiles = files.filter((f) => canUserAccessFile(f, req.user!.id));

    const items = mapFilesToInfos(accessibleFiles).map((info) => ({
      ...info,
      contentUrl: `/api/ai/files/${info.id}/content`,
    }));

    return res.json({ items });
  },
);

export default router;
