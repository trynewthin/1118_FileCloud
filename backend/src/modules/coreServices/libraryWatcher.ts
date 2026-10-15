/**
 * 文件库在线状态监控服务
 * 定时检测所有文件库的可访问性，维护实时状态
 */
import fs from "node:fs";
import { db } from "../../core/db/index.ts";
import { assertExistingLibraryRootPathAsync } from "../../core/config/pathSecurity.ts";
import { createLogger } from "../../core/logger/index.ts";

import { createPollingLoop } from "./pollingLoop.ts";

const logger = createLogger("LibraryWatcher");

// 库状态信息
export interface LibraryStatus {
  id: number;
  displayName: string;
  rootPath: string;
  isEnabled: boolean;
  isOnline: boolean;
  lastCheckAt: string;
}

// 状态变化回调类型
type StatusChangeCallback = (libraryId: number, isOnline: boolean, displayName: string) => void;

// 内存中的状态缓存
const statusCache = new Map<number, { rootPath: string; isOnline: boolean }>();

// 状态变化监听器
const changeListeners: StatusChangeCallback[] = [];

// 默认检测间隔（毫秒）
const DEFAULT_CHECK_INTERVAL = 3000;
let checkInterval = DEFAULT_CHECK_INTERVAL;
let probeGeneration = 0;
const activeProbes = new Set<Promise<boolean>>();

/**
 * 检测单个文件库是否在线
 */
/**
 * 获取所有启用的文件库
 */
const getEnabledLibraries = (): Array<{
  id: number;
  root_path: string;
  display_name: string;
  is_online_cached: number;
}> => {
  return db
    .prepare(
      "SELECT id, root_path, display_name, is_online_cached FROM file_libraries WHERE is_enabled = 1"
    )
    .all() as any[];
};

/**
 * 更新数据库中的在线状态
 */
const updateLibraryOnlineStatus = (libraryId: number, isOnline: boolean): void => {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE file_libraries SET is_online_cached = ?, last_online_check_at = ?, updated_at = ? WHERE id = ?"
  ).run(isOnline ? 1 : 0, now, now, libraryId);
};

/**
 * 执行一次全量检测
 */
const checkLibraryOnlineAsync = (rootPath: string): Promise<boolean> => {
  const probe = (async () => {
  try {
    const canonical = await assertExistingLibraryRootPathAsync(rootPath);
    await fs.promises.access(canonical, fs.constants.R_OK);
    const directory = await fs.promises.opendir(canonical);
    await directory.close();
    return true;
  } catch { return false; }
  })();
  activeProbes.add(probe);
  return probe.finally(() => { activeProbes.delete(probe); });
};

const performCheck = async (isCurrent: () => boolean): Promise<void> => {
  if (!isCurrent()) return;
  const libraries = getEnabledLibraries();
  const enabledIds = new Set(libraries.map(lib => lib.id));
  for (const id of statusCache.keys()) if (!enabledIds.has(id)) statusCache.delete(id);

  // One probe at a time bounds storage pressure, including network mounts.
  for (const lib of libraries) {
    if (!isCurrent()) return;
    const isOnline = await checkLibraryOnlineAsync(lib.root_path);
    if (!isCurrent()) return;
    // A library can be disabled/deleted or have its root changed during I/O.
    const current = db.prepare("SELECT root_path, is_enabled FROM file_libraries WHERE id = ?").get(lib.id) as
      { root_path: string; is_enabled: number } | undefined;
    if (!current || !current.is_enabled || current.root_path !== lib.root_path) {
      statusCache.delete(lib.id);
      continue;
    }
    const wasOnline = statusCache.get(lib.id)?.isOnline;
    updateLibraryOnlineStatus(lib.id, isOnline);
    statusCache.set(lib.id, { rootPath: lib.root_path, isOnline });
    if (wasOnline !== undefined && wasOnline !== isOnline) {
      for (const listener of [...changeListeners]) {
        try { listener(lib.id, isOnline, lib.display_name); }
        catch (error) { logger.error("监听器执行错误", error); }
      }
    }
  }
};

const polling = createPollingLoop(performCheck, error => logger.error("文件库状态检测失败", error));

export const startLibraryWatcher = (intervalMs: number = DEFAULT_CHECK_INTERVAL): void => {
  if (polling.isRunning()) return;
  polling.start(intervalMs);
  checkInterval = intervalMs;
};

export const stopLibraryWatcher = async (): Promise<void> => {
  probeGeneration += 1;
  await polling.stop();
  await Promise.all([...activeProbes]);
  statusCache.clear();
};

/**
 * 获取指定库的在线状态（从缓存）
 */
export const isLibraryOnline = async (libraryId: number): Promise<boolean> => {
  // Recheck membership before using cache: deleted/disabled roots cannot stay online.
  const row = db
    .prepare("SELECT root_path, is_enabled FROM file_libraries WHERE id = ?")
    .get(libraryId) as { root_path: string; is_enabled: number } | undefined;
  if (!row || !row.is_enabled) {
    statusCache.delete(libraryId);
    return false;
  }
  const cached = statusCache.get(libraryId);
  if (cached?.rootPath === row.root_path) return cached.isOnline;

  // 实时检测并更新缓存
  const generation = probeGeneration;
  const isOnline = await checkLibraryOnlineAsync(row.root_path);
  if (generation !== probeGeneration) return false;
  const current = db.prepare("SELECT root_path, is_enabled FROM file_libraries WHERE id = ?").get(libraryId) as
    { root_path: string; is_enabled: number } | undefined;
  if (!current || !current.is_enabled || current.root_path !== row.root_path) {
    statusCache.delete(libraryId);
    return false;
  }
  statusCache.set(libraryId, { rootPath: row.root_path, isOnline });

  return isOnline;
};

/**
 * 获取所有库的状态
 */
export const getAllLibraryStatus = (): LibraryStatus[] => {
  const libraries = db
    .prepare(
      "SELECT id, display_name, root_path, is_enabled, is_online_cached, last_online_check_at, updated_at FROM file_libraries ORDER BY id"
    )
    .all() as any[];

  return libraries.map((lib) => {
    // 优先使用缓存状态
    const cached = statusCache.get(lib.id);
    const cachedOnline = cached && cached.rootPath === lib.root_path ? cached.isOnline : undefined;
    const isOnline = Boolean(lib.is_enabled) && (cachedOnline !== undefined ? cachedOnline : Boolean(lib.is_online_cached));

    return {
      id: lib.id,
      displayName: lib.display_name,
      rootPath: lib.root_path,
      isEnabled: Boolean(lib.is_enabled),
      isOnline,
      lastCheckAt: lib.last_online_check_at || lib.updated_at,
    };
  });
};

/**
 * 注册状态变化监听器
 */
export const onLibraryStatusChange = (callback: StatusChangeCallback): void => {
  if (!changeListeners.includes(callback)) changeListeners.push(callback);
};

/**
 * 移除状态变化监听器
 */
export const offLibraryStatusChange = (callback: StatusChangeCallback): void => {
  const index = changeListeners.indexOf(callback);
  if (index !== -1) {
    changeListeners.splice(index, 1);
  }
};

/**
 * 强制刷新指定库的状态
 */
export const refreshLibraryStatus = async (libraryId: number): Promise<boolean> => {
  const row = db
    .prepare("SELECT root_path, display_name FROM file_libraries WHERE id = ? AND is_enabled = 1")
    .get(libraryId) as { root_path: string; display_name: string } | undefined;

  if (!row) {
    statusCache.delete(libraryId);
    return false;
  }

  const wasOnline = statusCache.get(libraryId)?.isOnline;
  const generation = probeGeneration;
  const isOnline = await checkLibraryOnlineAsync(row.root_path);
  if (generation !== probeGeneration) return false;
  const current = db.prepare("SELECT root_path, is_enabled FROM file_libraries WHERE id = ?").get(libraryId) as
    { root_path: string; is_enabled: number } | undefined;
  if (!current || !current.is_enabled || current.root_path !== row.root_path) {
    statusCache.delete(libraryId);
    return false;
  }

  statusCache.set(libraryId, { rootPath: row.root_path, isOnline });
  updateLibraryOnlineStatus(libraryId, isOnline);

  // 如果状态变化，通知监听器
  if (wasOnline !== undefined && wasOnline !== isOnline) {
    for (const listener of changeListeners) {
      try {
        listener(libraryId, isOnline, row.display_name);
      } catch (err) {
        console.error("[LibraryWatcher] 监听器执行错误:", err);
      }
    }
  }

  return isOnline;
};

/**
 * 获取检测间隔配置
 */
export const getCheckInterval = (): number => {
  return checkInterval;
};
