// ============================================================================
// AI 会话文件服务 - 存储层（文件系统操作）
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "../../../core/config/paths.ts";

// 会话文件存储根目录
const CONVERSATION_FILES_ROOT = "ai_conversation_files";

// 获取会话文件存储根目录的绝对路径
export const getConversationFilesRoot = (): string => {
  const root = path.join(getDataDir(), CONVERSATION_FILES_ROOT);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
};

// 构建用户目录路径：u_<userId>
const buildUserDir = (userId: number): string => {
  return `u_${userId}`;
};

// 构建会话目录路径：u_<userId>/c_<conversationId>
const buildConversationDir = (userId: number, conversationId: number): string => {
  return path.join(buildUserDir(userId), `c_${conversationId}`);
};

// 构建通用目录路径（无会话时）：u_<userId>/general
const buildGeneralDir = (userId: number): string => {
  return path.join(buildUserDir(userId), "general");
};

// 清洗文件名：只保留安全字符
const sanitizeFileName = (name: string): string => {
  // 移除路径分隔符和危险字符
  let safe = name.replace(/[\/\\:*?"<>|]/g, "_");
  // 移除连续的点（防止 ..）
  safe = safe.replace(/\.{2,}/g, ".");
  // 移除首尾的点和空格
  safe = safe.replace(/^[\s.]+|[\s.]+$/g, "");
  // 限制长度
  if (safe.length > 100) {
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);
    safe = base.slice(0, 100 - ext.length) + ext;
  }
  return safe || "unnamed";
};

// 生成存储文件名：<fileId>_<safeBaseName>.<ext>
export const generateStoredName = (
  fileId: number,
  originalName: string,
): string => {
  const safeName = sanitizeFileName(originalName);
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);
  return `${fileId}_${base}${ext}`;
};

// 生成相对路径
export const generateRelativePath = (
  userId: number,
  conversationId: number | null,
  storedName: string,
): string => {
  const dir = conversationId
    ? buildConversationDir(userId, conversationId)
    : buildGeneralDir(userId);
  return path.join(dir, storedName);
};

// 获取文件的绝对路径
export const getAbsolutePath = (relativePath: string): string => {
  const root = getConversationFilesRoot();
  const absPath = path.join(root, relativePath);
  
  // 安全检查：确保路径在根目录下
  const normalized = path.normalize(absPath);
  const normalizedRoot = path.normalize(root);
  if (!normalized.startsWith(normalizedRoot)) {
    throw new Error("文件路径不合法");
  }
  
  return normalized;
};

// 确保目录存在
export const ensureDirectoryExists = (relativePath: string): void => {
  const absPath = getAbsolutePath(relativePath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// 保存文件（从 Buffer）
export const saveFileFromBuffer = (
  relativePath: string,
  buffer: Buffer,
): { sizeBytes: number; sha256: string } => {
  ensureDirectoryExists(relativePath);
  const absPath = getAbsolutePath(relativePath);
  
  fs.writeFileSync(absPath, buffer);
  
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  
  return {
    sizeBytes: buffer.length,
    sha256,
  };
};

// 保存文件（从字符串内容）
export const saveFileFromString = (
  relativePath: string,
  content: string,
  encoding: BufferEncoding = "utf-8",
): { sizeBytes: number; sha256: string } => {
  const buffer = Buffer.from(content, encoding);
  return saveFileFromBuffer(relativePath, buffer);
};

// 读取文件为 Buffer
export const readFileAsBuffer = (relativePath: string): Buffer => {
  const absPath = getAbsolutePath(relativePath);
  if (!fs.existsSync(absPath)) {
    throw new Error("文件不存在");
  }
  return fs.readFileSync(absPath);
};

// 读取文件为字符串
export const readFileAsString = (
  relativePath: string,
  encoding: BufferEncoding = "utf-8",
): string => {
  const buffer = readFileAsBuffer(relativePath);
  return buffer.toString(encoding);
};

// 创建读取流
export const createReadStream = (relativePath: string): fs.ReadStream => {
  const absPath = getAbsolutePath(relativePath);
  if (!fs.existsSync(absPath)) {
    throw new Error("文件不存在");
  }
  return fs.createReadStream(absPath);
};

// 检查文件是否存在
export const fileExists = (relativePath: string): boolean => {
  try {
    const absPath = getAbsolutePath(relativePath);
    return fs.existsSync(absPath);
  } catch {
    return false;
  }
};

// 删除文件
export const deleteFile = (relativePath: string): boolean => {
  try {
    const absPath = getAbsolutePath(relativePath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// 获取文件大小
export const getFileSize = (relativePath: string): number => {
  const absPath = getAbsolutePath(relativePath);
  const stat = fs.statSync(absPath);
  return stat.size;
};

// 根据扩展名推断 MIME 类型
export const inferMimeType = (extension: string | null): string => {
  if (!extension) return "application/octet-stream";
  
  const ext = extension.toLowerCase().replace(/^\./, "");
  const mimeMap: Record<string, string> = {
    // 图片
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    // 文本
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/typescript",
    // 文档
    pdf: "application/pdf",
    // 其他
    zip: "application/zip",
  };
  
  return mimeMap[ext] || "application/octet-stream";
};

// 根据 MIME 类型推断文件用途
export const inferPurposeFromMime = (
  mimeType: string | null,
): "image" | "markdown" | "text" | "attachment" | "other" => {
  if (!mimeType) return "other";
  
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "text/markdown") return "markdown";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType === "application/json") return "text";
  
  return "other";
};
