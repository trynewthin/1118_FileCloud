/**
 * 模块系统类型定义
 */

import type { Router } from "express";
import type { TaskHandler } from "../tasks/types.ts";

// ============================================================================
// 模块定义接口
// ============================================================================

/**
 * 任务处理器注册项
 */
export interface TaskHandlerRegistration {
  type: string;
  handler: TaskHandler;
}

/**
 * 模块定义
 * 每个业务模块需要导出一个符合此接口的对象
 */
export interface ModuleDefinition {
  // 模块名称（用于日志和调试）
  name: string;
  
  // Express 路由（可选）
  router?: {
    // 路由前缀，如 "/api/files"
    prefix: string;
    // 路由实例
    instance: Router;
  };
  
  // 任务处理器列表（可选）
  taskHandlers?: TaskHandlerRegistration[];
  
  // 模块初始化函数（可选，在路由和任务注册之前调用）
  onInit?: () => void | Promise<void>;
  
  // 模块启动函数（可选，在所有模块注册完成后调用）
  onStart?: () => void | Promise<void>;
  
  // 模块关闭函数（可选，在服务关闭时调用）
  onShutdown?: () => void | Promise<void>;
}

// ============================================================================
// 模块加载器配置
// ============================================================================

export interface ModuleLoaderConfig {
  // 是否在加载时打印详细日志
  verbose: boolean;
}
