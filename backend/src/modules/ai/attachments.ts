import type { ChatAttachment } from "../../core/ai/client.ts";
import { readUploadAsBase64ById } from "./mediaHub.ts";

export const buildImageAttachmentsFromUploadIds = (
  uploadIds: number[],
): ChatAttachment[] => {
  const result: ChatAttachment[] = [];

  for (const rawId of uploadIds) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) continue;

    try {
      const { mimeType, dataBase64 } = readUploadAsBase64ById(id);
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
