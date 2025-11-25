import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import type { AiChatUpload } from "./service.ts";
import { getAiChatUploadById } from "./service.ts";

const projectRoot = path.resolve(process.cwd(), "..");
const uploadsRoot = path.join(projectRoot, "database");

export interface UploadBase64Result {
  mimeType: string;
  dataBase64: string;
}

const resolveUploadPath = (upload: AiChatUpload): string => {
  const absPath = path.join(uploadsRoot, upload.storage_rel_path);
  const rel = path.relative(uploadsRoot, absPath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("上传文件路径不合法");
  }
  return absPath;
};

export const readUploadAsBase64 = (upload: AiChatUpload): UploadBase64Result => {
  const absPath = resolveUploadPath(upload);

  if (!fs.existsSync(absPath)) {
    throw new Error("上传文件不存在");
  }

  const data = fs.readFileSync(absPath);
  const dataBase64 = Buffer.from(data).toString("base64");
  const mimeType = upload.mime_type || "application/octet-stream";

  return { mimeType, dataBase64 };
};

export const readUploadAsBase64ById = (id: number): UploadBase64Result => {
  const upload = getAiChatUploadById(id);
  if (!upload) {
    throw new Error("上传记录不存在");
  }
  return readUploadAsBase64(upload);
};
