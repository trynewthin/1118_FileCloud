/**
 * 统一模块加载器
 * 
 * 负责：
 * 1. 收集所有模块定义
 * 2. 按顺序初始化模块
 * 3. 注册路由到 Express
 * 4. 注册任务处理器到 TaskExecutor
 * 5. 管理模块生命周期
 */

import type { Express } from "express";
import type { ModuleDefinition, ModuleLoaderConfig } from "./types.ts";
import { registerTaskHandler } from "../tasks/executor.ts";
import { createLogger } from "../logger/index.ts";

const logger = createLogger("ModuleLoader");

// ============================================================================
// 模块注册表
// ============================================================================

const modules: ModuleDefinition[] = [];

// ============================================================================
// 默认配置
// ============================================================================

const defaultConfig: ModuleLoaderConfig = {
  verbose: true,
};

let config: ModuleLoaderConfig = { ...defaultConfig };

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 注册一个模块
 * 在应用启动前调用，收集所有模块定义
 */
export const registerModule = (module: ModuleDefinition): void => {
  modules.push(module);
  if (config.verbose) {
    logger.debug(`模块已注册: ${module.name}`);
  }
};

/**
 * 批量注册模块
 */
export const registerModules = (moduleList: ModuleDefinition[]): void => {
  for (const module of moduleList) {
    registerModule(module);
  }
};

/**
 * 初始化所有模块
 * 调用每个模块的 onInit 钩子
 */
export const initializeModules = async (): Promise<void> => {
  logger.info(`开始初始化 ${modules.length} 个模块...`);
  
  for (const module of modules) {
    if (module.onInit) {
      try {
        await module.onInit();
        logger.debug(`模块初始化完成: ${module.name}`);
      } catch (err) {
        logger.error(`模块初始化失败: ${module.name}`, err);
        throw err;
      }
    }
  }
  
  logger.info("所有模块初始化完成");
};

/**
 * 注册所有路由到 Express 应用
 */
export const mountRoutes = (app: Express): void => {
  let routeCount = 0;
  
  for (const module of modules) {
    if (module.router) {
      app.use(module.router.prefix, module.router.instance);
      routeCount++;
      logger.debug(`路由已挂载: ${module.router.prefix} (${module.name})`);
    }
  }
  
  logger.info(`共挂载 ${routeCount} 个路由`);
};

/**
 * 注册所有任务处理器
 */
export const registerAllTaskHandlers = (): void => {
  let handlerCount = 0;
  
  for (const module of modules) {
    if (module.taskHandlers && module.taskHandlers.length > 0) {
      for (const { type, handler } of module.taskHandlers) {
        registerTaskHandler(type, handler);
        handlerCount++;
      }
      logger.debug(`任务处理器已注册: ${module.name} (${module.taskHandlers.length} 个)`);
    }
  }
  
  logger.info(`共注册 ${handlerCount} 个任务处理器`);
};

/**
 * 启动所有模块
 * 调用每个模块的 onStart 钩子
 */
export const startModules = async (): Promise<void> => {
  for (const module of modules) {
    if (module.onStart) {
      try {
        await module.onStart();
        logger.debug(`模块启动完成: ${module.name}`);
      } catch (err) {
        logger.error(`模块启动失败: ${module.name}`, err);
        throw err;
      }
    }
  }
};

/**
 * 关闭所有模块
 * 调用每个模块的 onShutdown 钩子
 */
export const shutdownModules = async (): Promise<void> => {
  logger.info("开始关闭模块...");
  
  // 逆序关闭，后注册的先关闭
  for (const module of [...modules].reverse()) {
    if (module.onShutdown) {
      try {
        await module.onShutdown();
        logger.debug(`模块已关闭: ${module.name}`);
      } catch (err) {
        logger.error(`模块关闭失败: ${module.name}`, err);
      }
    }
  }
  
  logger.info("所有模块已关闭");
};

/**
 * 一键启动：初始化 + 挂载路由 + 注册任务 + 启动
 */
export const bootstrapModules = async (app: Express): Promise<void> => {
  await initializeModules();
  mountRoutes(app);
  registerAllTaskHandlers();
  await startModules();
};

/**
 * 获取已注册的模块列表（只读）
 */
export const getRegisteredModules = (): readonly ModuleDefinition[] => {
  return modules;
};

/**
 * 配置模块加载器
 */
export const configureModuleLoader = (newConfig: Partial<ModuleLoaderConfig>): void => {
  config = { ...config, ...newConfig };
};

// 导出类型
export type { ModuleDefinition, TaskHandlerRegistration, ModuleLoaderConfig } from "./types.ts";
