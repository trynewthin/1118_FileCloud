// ============================================================================
// AI 会话文件媒体读取服务
// ============================================================================

import { getFileById, type ConversationFile } from "./conversationFiles/index.ts";
import { readFileAsBuffer } from "./conversationFiles/storage.ts";

export interface FileBase64Result {
  mimeType: string;
  dataBase64: string;
}

// 读取会话文件为 Base64
export const readConversationFileAsBase64 = (file: ConversationFile): FileBase64Result => {
  const buffer = readFileAsBuffer(file.relative_path);
  const dataBase64 = buffer.toString("base64");
  const mimeType = file.mime_type || "application/octet-stream";

  return { mimeType, dataBase64 };
};

// 根据 ID 读取会话文件为 Base64
export const readConversationFileAsBase64ById = (id: number): FileBase64Result => {
  const file = getFileById(id);
  if (!file) {
    throw new Error("文件记录不存在");
  }
  return readConversationFileAsBase64(file);
};
