import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Request, Response } from "express";
import { getEntryById, buildRelativePathForEntry } from "../files/service.ts";
import { checkEntryPasswordIfProtected } from "../files/security.ts";
import { getLibraryRoot } from "../../core/middleware/index.ts";

// ============================================================================
// 配置常量
// ============================================================================

// 视频/音频流的读取缓冲区大小（256KB，减少系统调用次数）
const MEDIA_HIGH_WATER_MARK = 256 * 1024;
// 普通文件的读取缓冲区大小（64KB）
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;
// 缓存有效期（1小时）
const CACHE_MAX_AGE = 3600;

// ============================================================================
// 内容类型推断
// ============================================================================

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
    case ".aac":
      return "audio/aac";
    case ".m4a":
      return "audio/mp4";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
    case ".log":
      return "text/plain; charset=utf-8";
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".pdf":
      return "application/pdf";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
};

// 判断是否为媒体类型（视频/音频）
const isMediaType = (contentType: string): boolean => {
  return contentType.startsWith("video/") || contentType.startsWith("audio/");
};

// 判断是否可压缩（文本类文件）
const isCompressible = (contentType: string): boolean => {
  return /^(text\/|application\/json|application\/javascript)/.test(contentType);
};

// 解析 Range 请求头
const parseRangeHeader = (
  range: string,
  size: number,
): { start: number; end: number } | null => {
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;

  // 校验范围有效性
  if (isNaN(start) || isNaN(end) || start < 0 || end >= size || start > end) {
    return null;
  }

  return { start, end };
};

// 获取真实文件路径和基本信息（含密码校验），失败时抛出错误
export const resolveFileForStreaming = (
  entryId: string,
  password?: string,
): { realPath: string; contentType: string; size: number; mtime: Date } => {
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

  return { realPath, contentType, size: stat.size, mtime: stat.mtime };
};

// ============================================================================
// 流式传输选项
// ============================================================================

export interface StreamOptions {
  realPath: string;
  contentType: string;
  size: number;
  mtime: Date;                              // 文件修改时间（用于缓存）
  filename?: string;                        // 用于 Content-Disposition
  disposition?: "inline" | "attachment";    // 预览 vs 下载
  enableCache?: boolean;                    // 是否启用缓存（默认 true）
  enableCompression?: boolean;              // 是否启用压缩（默认 true）
}

// ============================================================================
// 核心流式传输函数（优化版）
// ============================================================================

/**
 * 高性能流式文件传输
 * 
 * 优化点：
 * 1. 连接中断检测：客户端断开时立即销毁流，释放资源
 * 2. 缓存控制：ETag + Last-Modified，支持 304 响应
 * 3. 高性能读取：媒体文件使用更大的缓冲区（256KB）
 * 4. Range 支持：视频拖拽进度时只传输需要的部分
 * 5. 压缩支持：文本类文件自动 gzip 压缩
 */
export const streamFile = (
  req: Request,
  res: Response,
  opts: StreamOptions,
): void => {
  const {
    realPath,
    contentType,
    size,
    mtime,
    filename,
    disposition = "inline",
    enableCache = true,
    enableCompression = true,
  } = opts;

  // 1. 缓存检查（ETag + Last-Modified）
  if (enableCache) {
    const etag = `"${size}-${mtime.getTime()}"`;
    const lastModified = mtime.toUTCString();

    // 检查条件请求，命中则返回 304
    const ifNoneMatch = req.headers["if-none-match"];
    const ifModifiedSince = req.headers["if-modified-since"];

    if (ifNoneMatch === etag || ifModifiedSince === lastModified) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", lastModified);
    res.setHeader("Cache-Control", `private, max-age=${CACHE_MAX_AGE}`);
  }

  // 2. 解析 Range 请求
  const range = req.headers.range;
  let start = 0;
  let end = size - 1;
  let statusCode = 200;

  if (range) {
    const parsed = parseRangeHeader(range, size);
    if (!parsed) {
      res.status(416).end();
      return;
    }
    start = parsed.start;
    end = parsed.end;
    statusCode = 206;
  }

  const chunkSize = end - start + 1;

  // 3. 创建读取流（媒体文件使用更大缓冲区）
  const highWaterMark = isMediaType(contentType) ? MEDIA_HIGH_WATER_MARK : DEFAULT_HIGH_WATER_MARK;
  const stream = fs.createReadStream(realPath, { start, end, highWaterMark });

  // 4. 连接中断处理（关键优化：客户端断开时立即释放资源）
  let streamDestroyed = false;
  const cleanup = () => {
    if (!streamDestroyed && !stream.destroyed) {
      streamDestroyed = true;
      stream.destroy();
    }
  };

  // 监听客户端断开事件
  req.on("close", cleanup);     // 客户端主动断开（如关闭视频播放器）
  req.on("aborted", cleanup);   // 请求被中止
  res.on("close", cleanup);     // 响应关闭

  // 5. 流错误处理
  stream.on("error", (err) => {
    console.error("[streamFile] 读取文件失败:", realPath, err.message);
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ message: "读取文件失败" });
    }
  });

  // 6. 构建响应头
  const headers: Record<string, string | number> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
  };

  // 文件名（用于下载）
  if (filename) {
    const encodedFilename = encodeURIComponent(filename);
    headers["Content-Disposition"] = `${disposition}; filename*=UTF-8''${encodedFilename}`;
  }

  // Range 响应头
  if (range) {
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }

  // 7. 压缩处理（仅对文本类文件，且非 Range 请求）
  const shouldCompress =
    enableCompression &&
    isCompressible(contentType) &&
    !range &&
    req.headers["accept-encoding"]?.includes("gzip");

  if (shouldCompress) {
    headers["Content-Encoding"] = "gzip";
    // 压缩后大小未知，不设置 Content-Length
    res.writeHead(statusCode, headers);
    stream.pipe(zlib.createGzip()).pipe(res);
  } else {
    headers["Content-Length"] = chunkSize;
    res.writeHead(statusCode, headers);
    stream.pipe(res);
  }
};

// ============================================================================
// 兼容旧接口（保持向后兼容）
// ============================================================================

/**
 * 以流式方式输出文件内容，支持 Range 请求
 * @deprecated 请使用 streamFile 函数
 */
export const streamFileWithRange = (
  req: Request,
  res: Response,
  opts: { realPath: string; contentType: string; size: number },
): void => {
  // 获取文件修改时间
  let mtime: Date;
  try {
    const stat = fs.statSync(opts.realPath);
    mtime = stat.mtime;
  } catch {
    mtime = new Date();
  }

  streamFile(req, res, {
    ...opts,
    mtime,
    enableCache: true,
    enableCompression: true,
  });
};
