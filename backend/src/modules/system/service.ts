import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface SystemDirEntry {
  name: string;
  path: string;
  is_directory: boolean;
}

export const listSystemDirectories = (dirPath?: string): SystemDirEntry[] => {
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
          if (fs.existsSync(drivePath)) {
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

      return drives;
    }

    const root = path.parse(process.cwd()).root || "/";
    const items = fs.readdirSync(root, { withFileTypes: true });
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

    return result;
  }

  const targetPath = path.resolve(dirPath);

  if (!fs.existsSync(targetPath)) {
    throw new Error("路径不存在");
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw new Error("目标不是文件夹");
  }

  const items = fs.readdirSync(targetPath, { withFileTypes: true });
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
