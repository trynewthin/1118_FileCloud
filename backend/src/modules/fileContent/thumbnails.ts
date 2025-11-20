import fs from "node:fs";
import path from "node:path";
import { db } from "../../core/db/index.ts";
import { getEntryById } from "../files/service.ts";
import { checkEntryPasswordIfProtected } from "../files/security.ts";

interface LibraryRow {
  id: number;
  root_path: string;
  is_enabled: number;
}

const INTERNAL_META_DIR = ".filecloud_meta";
const THUMBNAILS_DIR_NAME = "thumbnails";

// 查询文件库根路径
const getLibraryRoot = (libraryId: number): string => {
  const row = db
    .prepare(
      "SELECT id, root_path, is_enabled FROM file_libraries WHERE id = ? LIMIT 1",
    )
    .get(libraryId) as LibraryRow | undefined;

  if (!row) {
    throw new Error("文件库不存在");
  }

  if (!row.is_enabled) {
    throw new Error("文件库未启用");
  }

  return row.root_path;
};

// 获取指定条目对应的缩略图路径（若不存在或文件不适合缩略图，则返回 null）
export const getThumbnailPathForEntry = (
  entryId: string,
  password?: string,
): { thumbnailPath: string } | null => {
  const entry = getEntryById(entryId);
  if (!entry) {
    throw new Error("文件不存在或已删除");
  }

  if (entry.is_directory) {
    throw new Error("目录不支持缩略图");
  }

  const pwdCheck = checkEntryPasswordIfProtected(entryId, password);
  if (!pwdCheck.ok) {
    throw new Error(pwdCheck.message ?? "访问密码错误");
  }

  const rootPath = getLibraryRoot(entry.library_id);
  const thumbnailPath = path.join(
    rootPath,
    INTERNAL_META_DIR,
    THUMBNAILS_DIR_NAME,
    `${entryId}.jpg`,
  );

  if (!fs.existsSync(thumbnailPath)) {
    return null;
  }

  return { thumbnailPath };
};
