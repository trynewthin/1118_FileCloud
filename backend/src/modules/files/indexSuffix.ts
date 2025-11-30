/**
 * 索引后缀工具模块
 *
 * 用于生成、解析和构建带有 [XXXXXX] 后缀的物理文件名。
 * 后缀格式：6 位小写字母 + 数字，如 [a1b2c3]
 * 容量：36^6 ≈ 21 亿种组合，基本不会重复
 */

import path from "node:path";

// 后缀字符集：小写字母 + 数字
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;

// 后缀正则：匹配 [xxxxxx] 格式
const SUFFIX_REGEX = /\[([a-z0-9]{6})\]$/;

// 文件名最大长度（Windows/Linux 通用限制）
const MAX_FILENAME_LENGTH = 255;

// 超长文件名时需要截断的字符数（后缀长度 8 = [] + 6位）
const SUFFIX_TOTAL_LENGTH = SUFFIX_LENGTH + 2; // [xxxxxx] = 8

/**
 * 生成 6 位随机后缀
 */
export const generateIndexSuffix = (): string => {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    const idx = Math.floor(Math.random() * SUFFIX_CHARS.length);
    suffix += SUFFIX_CHARS[idx];
  }
  return suffix;
};

/**
 * 从物理文件名中解析出后缀
 * @param physicalName 物理文件名（可能带或不带后缀）
 * @returns 后缀字符串（不含方括号），如果没有后缀则返回 null
 */
export const parseIndexSuffix = (physicalName: string): string | null => {
  // 先获取不带扩展名的部分
  const ext = path.extname(physicalName);
  const baseName = ext ? physicalName.slice(0, -ext.length) : physicalName;

  const match = baseName.match(SUFFIX_REGEX);
  return match?.[1] ?? null;
};

/**
 * 从物理文件名中提取原始名称（不含后缀）
 * @param physicalName 物理文件名（带后缀）
 * @returns 原始名称（用户看到的名称）
 */
export const extractOriginalName = (physicalName: string): string => {
  const ext = path.extname(physicalName);
  const baseName = ext ? physicalName.slice(0, -ext.length) : physicalName;

  // 移除末尾的 [xxxxxx]
  const cleanBaseName = baseName.replace(SUFFIX_REGEX, "");

  return ext ? cleanBaseName + ext : cleanBaseName;
};

/**
 * 构建物理文件名（原始名称 + 后缀）
 * @param originalName 原始名称（用户看到的名称）
 * @param suffix 6 位后缀
 * @returns 物理文件名
 */
export const buildPhysicalName = (originalName: string, suffix: string): string => {
  const ext = path.extname(originalName);
  const baseName = ext ? originalName.slice(0, -ext.length) : originalName;

  // 计算最终文件名长度
  const suffixPart = `[${suffix}]`;
  const finalLength = baseName.length + suffixPart.length + ext.length;

  let finalBaseName = baseName;

  // 如果超长，截断原始名称末尾
  if (finalLength > MAX_FILENAME_LENGTH) {
    const maxBaseLength = MAX_FILENAME_LENGTH - suffixPart.length - ext.length;
    if (maxBaseLength > 0) {
      finalBaseName = baseName.slice(0, maxBaseLength);
    } else {
      // 极端情况：扩展名本身就很长，只保留后缀
      finalBaseName = "";
    }
  }

  return ext
    ? `${finalBaseName}${suffixPart}${ext}`
    : `${finalBaseName}${suffixPart}`;
};

/**
 * 检查文件名是否已经带有索引后缀
 * @param fileName 文件名
 * @returns 是否带有后缀
 */
export const hasIndexSuffix = (fileName: string): boolean => {
  return parseIndexSuffix(fileName) !== null;
};

/**
 * 根据后缀在指定库中查找对应的 entry_id
 * 这个函数需要在调用处传入 db 实例，避免循环依赖
 */
export const findEntryBySuffix = (
  db: any,
  libraryId: number,
  suffix: string,
): { id: string; original_name: string; is_directory: number } | null => {
  const row = db
    .prepare(
      "SELECT id, original_name, is_directory FROM file_entries WHERE library_id = ? AND index_suffix = ? AND is_deleted = 0 LIMIT 1",
    )
    .get(libraryId, suffix) as { id: string; original_name: string; is_directory: number } | undefined;

  return row ?? null;
};

/**
 * 根据后缀在指定库和父目录中查找对应的 entry
 */
export const findEntryBySuffixInParent = (
  db: any,
  libraryId: number,
  parentId: string | null,
  suffix: string,
): { id: string; original_name: string; is_directory: number; index_suffix: string } | null => {
  const row = db
    .prepare(
      "SELECT id, original_name, is_directory, index_suffix FROM file_entries WHERE library_id = ? AND parent_id IS ? AND index_suffix = ? LIMIT 1",
    )
    .get(libraryId, parentId, suffix) as
    | { id: string; original_name: string; is_directory: number; index_suffix: string }
    | undefined;

  return row ?? null;
};
