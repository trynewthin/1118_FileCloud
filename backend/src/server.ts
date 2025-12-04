/**
 * 服务器入口
 * 
 * 启动流程：
 * 1. 初始化数据库
 * 2. 配置日志系统
 * 3. 注册所有模块（路由 + 任务处理器）
 * 4. 启动任务 Worker
 * 5. 启动文件库监控服务
 * 6. 启动 HTTP 服务
 */

import { app } from "./app.ts";
import { initDatabase } from "./core/db/index.ts";
import { createLogger, setProductionMode } from "./core/logger/index.ts";
import { registerModules, bootstrapModules } from "./core/module-loader/index.ts";
import { startTaskWorker } from "./core/tasks/executor.ts";
import { startLibraryWatcher } from "./core/services/index.ts";
import { allModules } from "./modules/index.ts";
import { getTaskWorkerConfig } from "./modules/settings/service.ts";

const logger = createLogger("Server");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// 主启动函数
const bootstrap = async () => {
  // 1. 配置日志系统
  setProductionMode(IS_PRODUCTION);
  logger.info(`启动模式: ${IS_PRODUCTION ? "生产" : "开发"}`);

  // 2. 初始化数据库
  initDatabase();
  logger.info("数据库初始化完成");

  // 3. 注册所有模块
  registerModules(allModules);
  await bootstrapModules(app);
  logger.info("模块加载完成");

  // 4. 启动任务 Worker
  const workerConfig = getTaskWorkerConfig();
  logger.debug(`任务 Worker 配置: intervalMs=${workerConfig.intervalMs}, batchSize=${workerConfig.batchSize}`);
  startTaskWorker(workerConfig);
  logger.info("任务 Worker 已启动");

  // 5. 启动文件库监控服务
  startLibraryWatcher();
  logger.info("文件库监控服务已启动");

  // 6. 启动 HTTP 服务
  app.listen(PORT, () => {
    logger.info(`HTTP 服务已启动，端口: ${PORT}`);
  });
};

// 执行启动
bootstrap().catch((err) => {
  logger.error("启动失败", err);
  process.exit(1);
});
