import express from "express";
import type { Request, Response } from "express";
import fs from "node:fs";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { resolveFileForStreaming, streamFile } from "./service.ts";
import { getThumbnailPathForEntry } from "./thumbnails.ts";
import {
  getTranscodeForEntry,
  getTranscodedFilePath,
  needsTranscode,
  createOrResetTranscode,
} from "./transcodeService.ts";
import { TASK_TYPE_VIDEO_TRANSCODE } from "./transcodeTasks.ts";
import { createTask } from "../tasks/service.ts";
import { getEntryById } from "../files/service.ts";

const router = express.Router();

// 预览 / 播放 / 下载指定文件内容（支持 Range），普通登录用户即可
router.get(
  "/:id/stream",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const password = (req.query as { password?: string }).password;

    try {
      const info = resolveFileForStreaming(id, password);
      streamFile(req, res, info);
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "读取文件失败";
      return res.status(400).json({ message });
    }
  },
);

// 获取文件缩略图（普通登录用户即可），若不存在缩略图则返回 404
router.get(
  "/:id/thumbnail",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const password = (req.query as { password?: string }).password;

    try {
      const result = getThumbnailPathForEntry(id, password);
      if (!result) {
        return res.status(404).json({ message: "缩略图不存在" });
      }

      const thumbPath = result.thumbnailPath;

      if (!fs.existsSync(thumbPath)) {
        console.error("[thumbnail] 文件不存在 (existsSync false)", { id, thumbPath });
        return res.status(404).json({ message: "缩略图不存在" });
      }

      // 获取文件信息用于缓存
      const stat = fs.statSync(thumbPath);
      const etag = `"${stat.size}-${stat.mtimeMs}"`;
      const lastModified = stat.mtime.toUTCString();

      // 缓存检查
      if (req.headers["if-none-match"] === etag || req.headers["if-modified-since"] === lastModified) {
        return res.status(304).end();
      }

      // 设置缓存头（缩略图可以缓存更久）
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("ETag", etag);
      res.setHeader("Last-Modified", lastModified);
      res.setHeader("Cache-Control", "private, max-age=86400"); // 24小时

      const stream = fs.createReadStream(thumbPath);

      // 连接中断处理
      let streamDestroyed = false;
      const cleanup = () => {
        if (!streamDestroyed && !stream.destroyed) {
          streamDestroyed = true;
          stream.destroy();
        }
      };

      req.on("close", cleanup);
      res.on("close", cleanup);

      stream.on("error", (err) => {
        console.error("[thumbnail] 读取缩略图失败", { id, thumbPath, error: err });
        cleanup();
        if (!res.headersSent) {
          res.status(500).json({ message: "读取缩略图失败" });
        }
      });

      stream.pipe(res);
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "读取缩略图失败";
      console.error("[thumbnail] getThumbnailPathForEntry 抛错", { id, error: err });
      return res.status(400).json({ message });
    }
  },
);

// ============================================================================
// 转码相关接口
// ============================================================================

// 获取文件的转码状态
router.get(
  "/:id/transcode",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件不存在" });
    }

    // 检查是否需要转码
    const needs = needsTranscode(entry.extension);
    if (!needs) {
      return res.json({
        needsTranscode: false,
        status: null,
        progress: null,
        hasTranscodedVersion: false,
      });
    }

    // 获取转码记录
    const record = getTranscodeForEntry(id);
    
    return res.json({
      needsTranscode: true,
      status: record?.status ?? null,
      progress: record?.progress ?? null,
      hasTranscodedVersion: record?.status === "completed",
      errorMessage: record?.error_message ?? null,
    });
  },
);

// 触发转码任务
router.post(
  "/:id/transcode",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    const entry = getEntryById(id);
    if (!entry) {
      return res.status(404).json({ message: "文件不存在" });
    }

    if (entry.is_directory) {
      return res.status(400).json({ message: "不支持对目录进行转码" });
    }

    // 检查是否需要转码
    if (!needsTranscode(entry.extension)) {
      return res.status(400).json({ message: "该文件格式不需要转码" });
    }

    // 检查是否已有进行中的转码任务
    const existing = getTranscodeForEntry(id);
    if (existing && (existing.status === "pending" || existing.status === "processing")) {
      return res.status(400).json({ message: "转码任务正在进行中" });
    }

    // 创建转码任务
    const userId = req.user?.id ?? null;
    const task = createTask({
      type: TASK_TYPE_VIDEO_TRANSCODE,
      payload: { entryId: id, libraryId: entry.library_id },
      createdByUserId: userId,
    });

    // 立即创建/重置转码记录，确保前端能看到 pending 状态
    createOrResetTranscode(id, entry.library_id, task.id);

    return res.status(201).json({
      message: "转码任务已创建",
      taskId: task.id,
    });
  },
);

// 播放转码版本（如果存在）
router.get(
  "/:id/stream/transcoded",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ message: "文件索引 ID 不合法" });
    }

    // 获取转码文件路径
    const transcodedPath = getTranscodedFilePath(id);
    if (!transcodedPath) {
      return res.status(404).json({ message: "转码版本不存在" });
    }

    // 获取文件信息
    const stat = fs.statSync(transcodedPath);

    // 使用统一的流式传输
    streamFile(req, res, {
      realPath: transcodedPath,
      contentType: "video/mp4",
      size: stat.size,
      mtime: stat.mtime,
      enableCache: true,
      enableCompression: false, // 视频不压缩
    });
  },
);

export { router as fileContentRouter };
