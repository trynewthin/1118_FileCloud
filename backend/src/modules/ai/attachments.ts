import type { ChatAttachment } from "../../core/ai/client.ts";
import { readConversationFileAsBase64ById } from "./mediaHub.ts";

// 从文件 ID 构建图片附件（使用 conversation_files 表）
export const buildImageAttachmentsFromUploadIds = (
  fileIds: number[],
): ChatAttachment[] => {
  const result: ChatAttachment[] = [];

  for (const rawId of fileIds) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) continue;

    try {
      const { mimeType, dataBase64 } = readConversationFileAsBase64ById(id);
      if (!dataBase64) continue;

      result.push({
        kind: "image",
        mimeType: mimeType || "application/octet-stream",
        dataBase64,
      });
    } catch {
      continue;
    }
  }

  return result;
};
