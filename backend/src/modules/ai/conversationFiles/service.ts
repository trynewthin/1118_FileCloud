// ============================================================================
// AI 会话文件服务 - 业务逻辑层
// ============================================================================

import path from "node:path";
import type {
  ConversationFile,
  ConversationFileOrigin,
  ConversationFilePurpose,
  ConversationFileInfo,
  ListConversationFilesOptions,
} from "./types.ts";
import {
  getConversationFileById,
  createConversationFile,
  updateConversationFile,
  listConversationFiles,
  getConversationFilesByIds,
  softDeleteConversationFile,
  getFilesByConversationId,
  hardDeleteFilesByConversationId,
} from "./repository.ts";
import {
  generateStoredName,
  generateRelativePath,
  saveFileFromBuffer,
  saveFileFromString,
  createReadStream,
  fileExists,
  deleteFile as deletePhysicalFile,
  inferMimeType,
  inferPurposeFromMime,
} from "./storage.ts";

// ============================================================================
// 上传文件（用户上传图片等）
// ============================================================================

export interface UploadFileInput {
  userId: number;
  conversationId?: number | null;
  originalName: string;
  mimeType?: string | null;
  buffer: Buffer;
}

export interface UploadFileResult {
  file: ConversationFile;
  info: ConversationFileInfo;
}

export const uploadFile = (input: UploadFileInput): UploadFileResult => {
  const ext = path.extname(input.originalName).toLowerCase() || null;
  const mimeType = input.mimeType || inferMimeType(ext);
  const purpose = inferPurposeFromMime(mimeType);

  // 先创建记录获取 ID
  const tempFile = createConversationFile({
    userId: input.userId,
    conversationId: input.conversationId,
    origin: "upload",
    purpose,
    originalName: input.originalName,
    storedName: "temp", // 临时，稍后更新
    extension: ext,
    mimeType,
    sizeBytes: 0,
    relativePath: "temp",
  });

  // 生成存储名和路径
  const storedName = generateStoredName(tempFile.id, input.originalName);
  const relativePath = generateRelativePath(
    input.userId,
    input.conversationId ?? null,
    storedName,
  );

  // 保存文件
  const { sizeBytes, sha256 } = saveFileFromBuffer(relativePath, input.buffer);

  // 更新记录
  const file = updateConversationFile(tempFile.id, {
    stored_name: storedName,
    relative_path: relativePath,
    size_bytes: sizeBytes,
    sha256,
  })!;

  return {
    file,
    info: mapFileToInfo(file),
  };
};

// ============================================================================
// 创建生成文件（AI 工具生成 md 等）
// ============================================================================

export interface CreateGeneratedFileInput {
  userId: number;
  conversationId: number;
  messageId?: number | null;
  originalName: string;
  content: string;
  purpose?: ConversationFilePurpose;
  mimeType?: string | null;
}

export const createGeneratedFile = (
  input: CreateGeneratedFileInput,
): UploadFileResult => {
  const ext = path.extname(input.originalName).toLowerCase() || ".md";
  const mimeType = input.mimeType || inferMimeType(ext);
  const purpose = input.purpose || inferPurposeFromMime(mimeType);

  // 先创建记录获取 ID
  const tempFile = createConversationFile({
    userId: input.userId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    origin: "tool_generated",
    purpose,
    originalName: input.originalName,
    storedName: "temp",
    extension: ext,
    mimeType,
    sizeBytes: 0,
    relativePath: "temp",
  });

  // 生成存储名和路径
  const storedName = generateStoredName(tempFile.id, input.originalName);
  const relativePath = generateRelativePath(
    input.userId,
    input.conversationId,
    storedName,
  );

  // 保存文件
  const { sizeBytes, sha256 } = saveFileFromString(relativePath, input.content);

  // 更新记录
  const file = updateConversationFile(tempFile.id, {
    stored_name: storedName,
    relative_path: relativePath,
    size_bytes: sizeBytes,
    sha256,
  })!;

  return {
    file,
    info: mapFileToInfo(file),
  };
};

// ============================================================================
// 查询与读取
// ============================================================================

export const getFileById = (id: number): ConversationFile | null => {
  return getConversationFileById(id);
};

export const getFilesByIds = (ids: number[]): ConversationFile[] => {
  return getConversationFilesByIds(ids);
};

export const listFiles = (
  options: ListConversationFilesOptions,
): ConversationFile[] => {
  return listConversationFiles(options);
};

export const getFileReadStream = (
  file: ConversationFile,
): NodeJS.ReadableStream => {
  if (!fileExists(file.relative_path)) {
    throw new Error("文件不存在");
  }
  return createReadStream(file.relative_path);
};

// ============================================================================
// 删除
// ============================================================================

export const deleteFile = (id: number): boolean => {
  return softDeleteConversationFile(id);
};

// 删除会话的所有文件（包括物理文件和数据库记录）
export const deleteConversationFiles = (conversationId: number): number => {
  // 先获取所有文件记录
  const files = getFilesByConversationId(conversationId);
  
  // 删除物理文件
  for (const file of files) {
    try {
      deletePhysicalFile(file.relative_path);
    } catch {
      // 忽略删除失败（文件可能已不存在）
    }
  }
  
  // 删除数据库记录
  return hardDeleteFilesByConversationId(conversationId);
};

// ============================================================================
// 权限校验
// ============================================================================

export const canUserAccessFile = (
  file: ConversationFile,
  userId: number,
): boolean => {
  return file.user_id === userId;
};

// ============================================================================
// 映射到前端信息
// ============================================================================

export const mapFileToInfo = (file: ConversationFile): ConversationFileInfo => {
  return {
    id: file.id,
    conversationId: file.conversation_id,
    messageId: file.message_id,
    origin: file.origin,
    purpose: file.purpose,
    originalName: file.original_name,
    mimeType: file.mime_type,
    sizeBytes: file.size_bytes,
    createdAt: file.created_at,
    // URL 由路由层生成
  };
};

export const mapFilesToInfos = (files: ConversationFile[]): ConversationFileInfo[] => {
  return files.map(mapFileToInfo);
};
