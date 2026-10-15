import fs from "node:fs";
import { pathExists } from "../../core/fs.ts";
import path from "node:path";
import { getFsAllowedPaths } from "../../core/config/paths.ts";
import { assertAllowedFilesystemPath, canonicalizeFilesystemPath, isPathWithin } from "../../core/config/pathSecurity.ts";

export interface SystemDirEntry {
  name: string;
  path: string;
  is_directory: boolean;
}

// Only expose configured roots or their navigable ancestors in the initial list.
const filterByAllowedPaths = async (entries: SystemDirEntry[], allowedPaths: string[]): Promise<SystemDirEntry[]> => {
  if (allowedPaths.length === 0) return entries;
  const roots: string[] = [];
  for (const allowed of allowedPaths) {
    try { roots.push(await canonicalizeFilesystemPath(allowed)); } catch { /* Fail closed. */ }
  }
  const result: SystemDirEntry[] = [];
  for (const entry of entries) {
    try {
      const candidate = await canonicalizeFilesystemPath(entry.path);
      if (roots.some(root => isPathWithin(root, candidate) || isPathWithin(candidate, root))) result.push(entry);
    } catch { /* Inaccessible entries cannot be browsed. */ }
  }
  return result;
};

export const listSystemDirectories = async (dirPath?: string): Promise<SystemDirEntry[]> => {
  const allowedPaths = getFsAllowedPaths();
  
  // 未指定路径时：
  // - Windows：列出所有存在的盘符（C:\、D:\ 等）；
  // - 其他系统：列出根路径（通常是 /）下的一级目录。
  if (!dirPath) {
    if (process.platform === "win32") {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const drives: SystemDirEntry[] = [];

      for (const ch of letters) {
        const drivePath = `${ch}:\\`;
        try {
          if ((await pathExists(drivePath))) {
            drives.push({
              name: drivePath,
              path: drivePath,
              is_directory: true,
            });
          }
        } catch {
          // 忽略不可访问的盘符
        }
      }

      return filterByAllowedPaths(drives, allowedPaths);
    }

    const root = path.parse(process.cwd()).root || "/";
    const items = (await fs.promises.readdir(root, { withFileTypes: true }));
    const result: SystemDirEntry[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        result.push({
          name: item.name,
          path: path.join(root, item.name),
          is_directory: true,
        });
      }
    }

    return filterByAllowedPaths(result, allowedPaths);
  }

  const targetPath = (await assertAllowedFilesystemPath(dirPath));

  if (!(await pathExists(targetPath))) {
    throw new Error("路径不存在");
  }

  const stat = (await fs.promises.stat(targetPath));
  if (!stat.isDirectory()) {
    throw new Error("目标不是文件夹");
  }

  const items = (await fs.promises.readdir(targetPath, { withFileTypes: true }));
  const result: SystemDirEntry[] = [];

  for (const item of items) {
    if (item.isDirectory()) {
      result.push({
        name: item.name,
        path: path.join(targetPath, item.name),
        is_directory: true,
      });
    }
  }

  return result;
};

export const getPathSeparator = () => path.sep;
export const getRootPath = () => path.parse(process.cwd()).root;
