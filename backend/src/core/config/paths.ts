import fs from "node:fs";
import path from "node:path";

const resolvePathFromProjectRoot = (p: string): string => {
  const normalized = (p ?? "").trim();
  if (!normalized) {
    throw new Error("路径配置不能为空");
  }

  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  return path.resolve(getProjectRoot(), normalized);
};

const ensureDirExists = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const getBackendRoot = (): string => {
  return path.resolve(import.meta.dir, "..", "..", "..");
};

export const getProjectRoot = (): string => {
  return path.resolve(getBackendRoot(), "..");
};

export const getDataDir = (): string => {
  const env = process.env.FILECLOUD_DATA_DIR;
  const dir = env ? resolvePathFromProjectRoot(env) : path.join(getProjectRoot(), "database");
  ensureDirExists(dir);
  return dir;
};

export const getDbPath = (): string => {
  const env = process.env.FILECLOUD_DB_PATH;
  const dbPath = env ? resolvePathFromProjectRoot(env) : path.join(getDataDir(), "filecloud.db");
  ensureDirExists(path.dirname(dbPath));
  return dbPath;
};

export const getAiUploadsStorageDir = (): string => {
  const env = process.env.FILECLOUD_AI_UPLOADS_DIR;
  const dir = env ? resolvePathFromProjectRoot(env) : path.join(getDataDir(), "ai_uploads");
  ensureDirExists(dir);
  return dir;
};

export const getBackgroundsStorageDir = (): string => {
  const env = process.env.FILECLOUD_BACKGROUNDS_DIR;
  const dir = env ? resolvePathFromProjectRoot(env) : path.join(getDataDir(), "backgrounds");
  ensureDirExists(dir);
  return dir;
};

// 是否允许用户注册
export const isRegisterAllowed = (): boolean => {
  const env = process.env.ALLOW_REGISTER;
  return env?.toLowerCase() === "true";
};

// 获取服务器目录访问密钥（空字符串表示不需要密钥）
export const getFsAccessKey = (): string => {
  return process.env.FS_ACCESS_KEY?.trim() || "";
};

// 获取可浏览的目录白名单（空数组表示不限制）
export const getFsAllowedPaths = (): string[] => {
  const env = process.env.FS_ALLOWED_PATHS?.trim() || "";
  if (!env) return [];
  
  // 支持逗号分隔的多个路径
  return env
    .split(",")
    .map((p) => path.resolve(p.trim()))
    .filter((p) => p.length > 0);
};
