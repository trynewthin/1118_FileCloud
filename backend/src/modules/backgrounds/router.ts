/**
 * 背景图片路由
 * 
 * 提供背景图片的上传、列表、获取、删除接口
 */

import { Router } from "express";
import Busboy from "busboy";
import { createReadStream } from "fs";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import {
  saveBackgroundImage,
  listBackgroundImages,
  getBackgroundImagePath,
  deleteBackgroundImage,
  isAllowedExtension,
  isAllowedSize,
} from "./service.ts";

export const backgroundsRouter = Router();

// 最大文件大小 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/backgrounds
 * 上传背景图片（支持多文件）
 * 使用 Busboy 处理 multipart/form-data
 */
backgroundsRouter.post(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    const results: { id: string; name: string }[] = [];
    const errors: string[] = [];
    const filePromises: Promise<void>[] = [];

    const busboy = Busboy({
      headers: req.headers,
    });

    busboy.on("file", (fieldname, file, info) => {
      const { filename } = info;

      // 检查扩展名
      if (!isAllowedExtension(filename)) {
        errors.push(`${filename}: 不支持的图片格式`);
        file.resume(); // 跳过该文件
        return;
      }

      const chunks: Buffer[] = [];
      let fileSize = 0;
      let fileTooLarge = false;

      file.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;
        if (fileSize > MAX_FILE_SIZE) {
          fileTooLarge = true;
          file.resume();
          return;
        }
        chunks.push(chunk);
      });

      const filePromise = new Promise<void>((resolve) => {
        file.on("end", async () => {
          if (fileTooLarge) {
            errors.push(`${filename}: 文件过大（最大 10MB）`);
            resolve();
            return;
          }

          try {
            const buffer = Buffer.concat(chunks);
            const image = await saveBackgroundImage({
              originalname: filename,
              buffer,
              size: buffer.length,
            });
            results.push({ id: image.id, name: image.name });
          } catch (err) {
            errors.push(`${filename}: 保存失败`);
          }
          resolve();
        });
      });

      filePromises.push(filePromise);
    });

    busboy.on("finish", async () => {
      await Promise.all(filePromises);
      res.json({
        uploads: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    });

    busboy.on("error", (err) => {
      console.error("上传背景图片失败:", err);
      res.status(500).json({ error: "上传背景图片失败" });
    });

    req.pipe(busboy);
  }
);

/**
 * GET /api/backgrounds
 * 获取背景图片列表
 */
backgroundsRouter.get(
  "/",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    try {
      const images = listBackgroundImages();
      return res.json({ images });
    } catch (err) {
      console.error("获取背景图片列表失败:", err);
      return res.status(500).json({ error: "获取背景图片列表失败" });
    }
  }
);

/**
 * GET /api/backgrounds/:id
 * 获取背景图片文件（无需鉴权，用于 img src）
 */
backgroundsRouter.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const filepath = getBackgroundImagePath(id);

    if (!filepath) {
      return res.status(404).json({ error: "背景图片不存在" });
    }

    // 获取文件扩展名来设置 Content-Type
    const ext = filepath.slice(filepath.lastIndexOf(".")).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
    };

    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 缓存一年

    const stream = createReadStream(filepath);
    stream.pipe(res);
  } catch (err) {
    console.error("获取背景图片失败:", err);
    return res.status(500).json({ error: "获取背景图片失败" });
  }
});

/**
 * DELETE /api/backgrounds/:id
 * 删除背景图片
 */
backgroundsRouter.delete(
  "/:id",
  authenticate,
  requirePermission(PermissionLevel.User),
  (req, res) => {
    try {
      const { id } = req.params;
      const success = deleteBackgroundImage(id as string);

      if (!success) {
        return res.status(404).json({ error: "背景图片不存在" });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("删除背景图片失败:", err);
      return res.status(500).json({ error: "删除背景图片失败" });
    }
  }
);
