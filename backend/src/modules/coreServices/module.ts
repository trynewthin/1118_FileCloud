/**
 * CoreServices 模块定义
 *
 * 用于承载常驻后台服务（如 LibraryWatcher），统一纳入 ModuleLoader 生命周期管理。
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { createLogger } from "../../core/logger/index.ts";
import { startLibraryWatcher, stopLibraryWatcher } from "./index.ts";

const logger = createLogger("CoreServices");

export const coreServicesModule: ModuleDefinition = {
  name: "CoreServices",
  onStart: async () => {
    // LibraryWatcher 自身具备幂等保护（重复启动会 warn 并 return）
    startLibraryWatcher();
    logger.info("常驻服务已启动");
  },
  onShutdown: async () => {
    stopLibraryWatcher();
    logger.info("常驻服务已停止");
  },
};
