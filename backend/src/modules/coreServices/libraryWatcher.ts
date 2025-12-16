/**
 * 文件库在线状态监控服务
 * 定时检测所有文件库的可访问性，维护实时状态
 */
import fs from "node:fs";
import { db } from "../../core/db/index.ts";
import { createLogger } from "../../core/logger/index.ts";

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
const statusCache = new Map<number, boolean>();

// 状态变化监听器
const changeListeners: StatusChangeCallback[] = [];

// 定时器句柄
let watcherTimer: ReturnType<typeof setInterval> | null = null;

// 默认检测间隔（毫秒）
const DEFAULT_CHECK_INTERVAL = 3000;

/**
 * 检测单个文件库是否在线
 */
const checkLibraryOnline = (rootPath: string): boolean => {
  try {
    // 1. 检查路径是否存在
    if (!fs.existsSync(rootPath)) {
      return false;
    }

    // 2. 检查是否可读
    fs.accessSync(rootPath, fs.constants.R_OK);

    // 3. 尝试读取目录（验证实际可访问，处理网络驱动器等情况）
    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    
    // 能读取到内容（即使是空目录）说明在线
    return true;
  } catch {
    return false;
  }
};

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
const performCheck = (): void => {
  const libraries = getEnabledLibraries();
  const now = new Date().toISOString();

  for (const lib of libraries) {
    const wasOnline = statusCache.get(lib.id);
    const isOnline = checkLibraryOnline(lib.root_path);

    // 更新缓存
    statusCache.set(lib.id, isOnline);

    // 状态发生变化
    if (wasOnline !== undefined && wasOnline !== isOnline) {
      // 更新数据库
      updateLibraryOnlineStatus(lib.id, isOnline);

      // 通知监听器
      for (const listener of changeListeners) {
        try {
          listener(lib.id, isOnline, lib.display_name);
        } catch (err) {
          logger.error("监听器执行错误", err);
        }
      }

      logger.info(
        `文件库 "${lib.display_name}" (ID: ${lib.id}) 状态变化: ${wasOnline ? "在线" : "离线"} -> ${isOnline ? "在线" : "离线"}`
      );
    } else if (wasOnline === undefined) {
      // 首次检测，同步数据库状态
      if (lib.is_online_cached !== (isOnline ? 1 : 0)) {
        updateLibraryOnlineStatus(lib.id, isOnline);
      }
    }
  }
};

/**
 * 启动监控服务
 */
export const startLibraryWatcher = (intervalMs: number = DEFAULT_CHECK_INTERVAL): void => {
  if (watcherTimer) {
    logger.warn("服务已在运行");
    return;
  }

  logger.info(`启动文件库监控服务，检测间隔: ${intervalMs}ms`);

  // 立即执行一次检测
  performCheck();

  // 启动定时检测
  watcherTimer = setInterval(performCheck, intervalMs);
};

/**
 * 停止监控服务
 */
export const stopLibraryWatcher = (): void => {
  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
    logger.info("文件库监控服务已停止");
  }
};

/**
 * 获取指定库的在线状态（从缓存）
 */
export const isLibraryOnline = (libraryId: number): boolean => {
  const cached = statusCache.get(libraryId);
  if (cached !== undefined) {
    return cached;
  }

  // 缓存未命中，从数据库读取
  const row = db
    .prepare("SELECT root_path, is_online_cached FROM file_libraries WHERE id = ?")
    .get(libraryId) as { root_path: string; is_online_cached: number } | undefined;

  if (!row) {
    return false;
  }

  // 实时检测并更新缓存
  const isOnline = checkLibraryOnline(row.root_path);
  statusCache.set(libraryId, isOnline);

  return isOnline;
};

/**
 * 获取所有库的状态
 */
export const getAllLibraryStatus = (): LibraryStatus[] => {
  const libraries = db
    .prepare(
      "SELECT id, display_name, root_path, is_enabled, is_online_cached, last_online_check_at FROM file_libraries ORDER BY id"
    )
    .all() as any[];

  return libraries.map((lib) => {
    // 优先使用缓存状态
    const cachedOnline = statusCache.get(lib.id);
    const isOnline = cachedOnline !== undefined ? cachedOnline : Boolean(lib.is_online_cached);

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
  changeListeners.push(callback);
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
export const refreshLibraryStatus = (libraryId: number): boolean => {
  const row = db
    .prepare("SELECT root_path, display_name FROM file_libraries WHERE id = ?")
    .get(libraryId) as { root_path: string; display_name: string } | undefined;

  if (!row) {
    return false;
  }

  const wasOnline = statusCache.get(libraryId);
  const isOnline = checkLibraryOnline(row.root_path);

  statusCache.set(libraryId, isOnline);
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
  return DEFAULT_CHECK_INTERVAL;
};
