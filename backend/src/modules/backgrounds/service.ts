/**
 * 背景图片服务
 * 
 * 负责背景图片的存储、查询、删除
 * 图片存储在 database/backgrounds 目录下
 */

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { createLogger } from "../../core/logger/index.ts";
import { getBackgroundsStorageDir } from "../../core/config/paths.ts";

const logger = createLogger("Backgrounds");

// 支持的图片扩展名
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

// 最大文件大小（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface BackgroundImage {
  id: string;
  name: string;
  size: number;
  createdAt: number;
}

/**
 * 获取背景图片存储目录的绝对路径
 */
export function getBackgroundsDir(): string {
  const dir = getBackgroundsStorageDir();
  // 确保目录存在
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(`创建背景图片目录: ${dir}`);
  }
  return dir;
}

/**
 * 生成唯一的背景图片 ID
 */
function generateId(): string {
  return `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 检查文件扩展名是否允许
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * 检查文件大小是否允许
 */
export function isAllowedSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/**
 * 保存背景图片
 */
export async function saveBackgroundImage(
  file: { originalname: string; buffer: Buffer; size: number }
): Promise<BackgroundImage> {
  const dir = getBackgroundsDir();
  const id = generateId();
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
  const filename = `${id}${ext}`;
  const filepath = join(dir, filename);

  // 写入文件
  await Bun.write(filepath, file.buffer);

  logger.info(`保存背景图片: ${filename}`);

  return {
    id,
    name: file.originalname,
    size: file.size,
    createdAt: Date.now(),
  };
}

/**
 * 获取所有背景图片列表
 */
export function listBackgroundImages(): BackgroundImage[] {
  const dir = getBackgroundsDir();
  const files = readdirSync(dir);

  const images: BackgroundImage[] = [];

  for (const filename of files) {
    // 检查是否是图片文件
    if (!isAllowedExtension(filename)) continue;

    const filepath = join(dir, filename);
    const stat = statSync(filepath);

    // 从文件名提取 ID（去掉扩展名）
    const id = filename.slice(0, filename.lastIndexOf("."));

    images.push({
      id,
      name: filename,
      size: stat.size,
      createdAt: stat.birthtimeMs,
    });
  }

  // 按创建时间倒序
  images.sort((a, b) => b.createdAt - a.createdAt);

  return images;
}

/**
 * 根据 ID 获取背景图片文件路径
 */
export function getBackgroundImagePath(id: string): string | null {
  const dir = getBackgroundsDir();
  const files = readdirSync(dir);

  for (const filename of files) {
    if (filename.startsWith(id + ".")) {
      return join(dir, filename);
    }
  }

  return null;
}

/**
 * 删除背景图片
 */
export function deleteBackgroundImage(id: string): boolean {
  const filepath = getBackgroundImagePath(id);
  if (!filepath) {
    return false;
  }

  try {
    unlinkSync(filepath);
    logger.info(`删除背景图片: ${id}`);
    return true;
  } catch (err) {
    logger.error(`删除背景图片失败: ${id}`, err);
    return false;
  }
}
