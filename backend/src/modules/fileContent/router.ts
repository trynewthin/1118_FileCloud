import express from "express";
import type { Request, Response } from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { resolveFileForStreaming, streamFileWithRange } from "./service.ts";
import { getThumbnailPathForEntry } from "./thumbnails.ts";

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
      streamFileWithRange(req, res, info);
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

      res.sendFile(result.thumbnailPath, (err) => {
        if (err) {
          return res.status(500).json({ message: "读取缩略图失败" });
        }
      });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "读取缩略图失败";
      return res.status(400).json({ message });
    }
  },
);

export { router as fileContentRouter };
