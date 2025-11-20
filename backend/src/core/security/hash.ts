import crypto from "node:crypto";

// 使用 SHA-256 对密钥进行不可逆哈希
export const hashSecret = (secret: string): string => {
  return crypto.createHash("sha256").update(secret).digest("hex");
};
