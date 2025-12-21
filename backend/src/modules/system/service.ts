import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getFsAllowedPaths } from "../../core/config/paths.ts";

export interface SystemDirEntry {
  name: string;
  path: string;
  is_directory: boolean;
}

// 检查路径是否在白名单内（包含白名单目录本身及其子目录）
const isPathAllowed = (targetPath: string, allowedPaths: string[]): boolean => {
  if (allowedPaths.length === 0) return true; // 无白名单则不限制
  
  const normalizedTarget = path.resolve(targetPath).toLowerCase();
  
  for (const allowed of allowedPaths) {
    const normalizedAllowed = path.resolve(allowed).toLowerCase();
    // 目标路径等于白名单路径，或是其子目录
    if (normalizedTarget === normalizedAllowed || 
        normalizedTarget.startsWith(normalizedAllowed + path.sep)) {
      return true;
    }
  }
  
  return false;
};

// 过滤并返回白名单内的目录
const filterByAllowedPaths = (entries: SystemDirEntry[], allowedPaths: string[]): SystemDirEntry[] => {
  if (allowedPaths.length === 0) return entries;
  
  return entries.filter((entry) => {
    const entryPath = path.resolve(entry.path).toLowerCase();
    
    for (const allowed of allowedPaths) {
      const normalizedAllowed = path.resolve(allowed).toLowerCase();
      // 条目路径等于白名单、是其子目录、或是其父目录（允许导航到白名单）
      if (entryPath === normalizedAllowed ||
          entryPath.startsWith(normalizedAllowed + path.sep) ||
          normalizedAllowed.startsWith(entryPath + path.sep)) {
        return true;
      }
    }
    
    return false;
  });
};

export const listSystemDirectories = (dirPath?: string): SystemDirEntry[] => {
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

      return filterByAllowedPaths(drives, allowedPaths);
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

    return filterByAllowedPaths(result, allowedPaths);
  }

  const targetPath = path.resolve(dirPath);
  
  // 检查目标路径是否在白名单内
  if (!isPathAllowed(targetPath, allowedPaths)) {
    throw new Error("无权访问此目录");
  }

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
