import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { getEntryById, buildRelativePathForEntry } from "../files/service.ts";
import { checkEntryPasswordIfProtected } from "../files/security.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";

// 注意：getLibraryRoot 已统一从 core/middleware 导入

// 简单根据扩展名推断内容类型
const guessContentType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ogg":
    case ".ogv":
      return "video/ogg";
    case ".mkv":
      // Matroska 容器常用类型
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    case ".mov":
      return "video/quicktime";
    case ".wmv":
      return "video/x-ms-wmv";
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".flac":
      return "audio/flac";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".txt":
    case ".log":
      return "text/plain; charset=utf-8";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
};

// 获取真实文件路径和基本信息（含密码校验），失败时抛出错误
export const resolveFileForStreaming = (
  entryId: string,
  password?: string,
): { realPath: string; contentType: string; size: number } => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件不存在或已删除");
  }

  if (entry.is_directory) {
    throw new Error("不支持对目录进行内容预览/下载");
  }

  const pwdCheck = checkEntryPasswordIfProtected(entryId, password);
  if (!pwdCheck.ok) {
    throw new Error(pwdCheck.message ?? "访问密码错误");
  }

  const rootPath = getLibraryRoot(entry.library_id);

  // 使用 files.service 中的 buildRelativePathForEntry 构建物理路径
  const relativePath = buildRelativePathForEntry(entry);
  const realPath = path.join(rootPath, relativePath);

  if (!fs.existsSync(realPath)) {
    throw new Error("实际文件不存在");
  }

  const stat = fs.statSync(realPath);
  const contentType = guessContentType(realPath);

  return { realPath, contentType, size: stat.size };
};

// 以流式方式输出文件内容，支持 Range 请求（适合视频/音频在线播放）
export const streamFileWithRange = (
  req: Request,
  res: Response,
  opts: { realPath: string; contentType: string; size: number },
) => {
  const { realPath, contentType, size } = opts;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": size,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(realPath).pipe(res);
    return;
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    res.status(416).end();
    return;
  }

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  if (isNaN(start) || isNaN(end) || start < 0 || end >= size || start > end) {
    res.status(416).end();
    return;
  }

  const chunkSize = end - start + 1;
  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Type": contentType,
  });

  fs.createReadStream(realPath, { start, end }).pipe(res);
};
