/**
 * 任务执行器（重构版）
 * 
 * 核心改进：
 * 1. 事件驱动：任务创建后立即触发执行，轮询仅作为兜底
 * 2. 并发控制：按任务类别限制并发数
 * 3. 崩溃恢复：启动时重置所有 RUNNING 状态的任务
 * 4. 重试机制：失败任务自动重试
 * 5. 取消支持：支持取消正在执行的任务
 */

import { EventEmitter } from "events";
import { createLogger } from "../logger/index.ts";
import {
  type TaskType,
  type TaskCategory,
  type TaskHandler,
  type TaskContext,
  type TaskRecord,
  type TaskPayload,
  type TaskExecutorConfig,
  type DetailProgress,
  TaskCategories,
  TaskTypeToCategory,
  DEFAULT_EXECUTOR_CONFIG,
  generateTaskDescriptor,
} from "./types.ts";

const logger = createLogger("TaskExecutor");

// ============================================================================
// 任务服务层接口（避免循环依赖）
// ============================================================================

interface TaskService {
  getTaskById(id: number): TaskRecord | null;
  listPendingTasks(limit: number): TaskRecord[];
  updateTaskStatus(params: {
    id: number;
    status: string;
    progress?: number;
    detailProgress?: DetailProgress | null;
    errorMessage?: string | null;
    markStarted?: boolean;
    markFinished?: boolean;
  }): TaskRecord | null;
  createTask(input: {
    type: string;
    payload: unknown;
    parentTaskId?: number | null;
    createdByUserId?: number | null;
    priority?: number;
  }): TaskRecord;
  resetRunningTasks(): number;
  incrementRetryCount(id: number): void;
}

// ============================================================================
// 执行器状态
// ============================================================================

// 任务处理器注册表（支持任意字符串类型）
const handlers = new Map<string, TaskHandler>();

// 事件发射器
const emitter = new EventEmitter();
const TASK_CREATED_EVENT = "task:created";

// 各类别当前运行中的任务数
const runningCounts: Record<TaskCategory, number> = {
  [TaskCategories.IO]: 0,
  [TaskCategories.CPU]: 0,
  [TaskCategories.QUICK]: 0,
};

// 正在执行的任务 ID 集合（用于取消检测）
const runningTaskIds = new Set<number>();
const cancelledTaskIds = new Set<number>();

// 配置
let config: TaskExecutorConfig = { ...DEFAULT_EXECUTOR_CONFIG };

// 任务服务引用（延迟注入，避免循环依赖）
let taskService: TaskService | null = null;

// 执行器是否已启动
let isStarted = false;

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 注入任务服务（在启动前调用）
 */
export const injectTaskService = (service: TaskService): void => {
  taskService = service;
};

/**
 * 注册任务处理器
 */
export const registerTaskHandler = (type: string, handler: TaskHandler): void => {
  handlers.set(type, handler);
  logger.debug(`注册任务处理器: ${type}`);
};

/**
 * 配置执行器
 */
export const configureExecutor = (newConfig: Partial<TaskExecutorConfig>): void => {
  config = { ...config, ...newConfig };
};

/**
 * 通知有新任务创建（由 createTask 调用）
 */
export const notifyTaskCreated = (): void => {
  emitter.emit(TASK_CREATED_EVENT);
};

/**
 * 取消任务
 */
export const cancelTask = (taskId: number): boolean => {
  if (runningTaskIds.has(taskId)) {
    cancelledTaskIds.add(taskId);
    logger.info(`任务 #${taskId} 已标记为取消`);
    return true;
  }
  return false;
};

/**
 * 启动执行器
 */
export const startExecutor = (): void => {
  if (isStarted) {
    logger.warn("执行器已在运行");
    return;
  }
  if (!taskService) {
    throw new Error("任务服务未注入，请先调用 injectTaskService");
  }

  isStarted = true;
  logger.info("任务执行器启动");

  // 崩溃恢复：重置所有 RUNNING 状态的任务
  const resetCount = taskService.resetRunningTasks();
  if (resetCount > 0) {
    logger.info(`崩溃恢复：重置 ${resetCount} 个中断的任务`);
  }

  // 监听任务创建事件
  emitter.on(TASK_CREATED_EVENT, () => {
    // 使用 setTimeout(0) 避免阻塞创建者
    setTimeout(() => tryProcessTasks(), 0);
  });

  // 启动兜底轮询
  setInterval(() => {
    tryProcessTasks();
  }, config.pollIntervalMs);

  // 立即尝试处理一次
  tryProcessTasks();
};

/**
 * 获取执行器状态
 */
export const getExecutorStatus = (): {
  isStarted: boolean;
  runningCounts: Record<TaskCategory, number>;
  handlerCount: number;
} => {
  return {
    isStarted,
    runningCounts: { ...runningCounts },
    handlerCount: handlers.size,
  };
};

// ============================================================================
// 内部实现
// ============================================================================

/**
 * 尝试处理待执行的任务
 */
const tryProcessTasks = (): void => {
  if (!taskService) return;

  // 获取待执行任务
  const pendingTasks = taskService.listPendingTasks(20);
  
  for (const task of pendingTasks) {
    const category = TaskTypeToCategory[task.type] ?? TaskCategories.QUICK;
    const maxConcurrency = config.concurrency[category];
    
    // 检查该类别是否还有并发余量
    if (runningCounts[category] >= maxConcurrency) {
      continue;
    }
    
    // 检查是否有处理器（支持任意字符串类型）
    if (!handlers.has(task.type)) {
      logger.error(`未找到任务类型 ${task.type} 的处理器`);
      taskService.updateTaskStatus({
        id: task.id,
        status: "FAILED",
        errorMessage: `未找到任务类型 ${task.type} 的处理器`,
        markStarted: true,
        markFinished: true,
      });
      continue;
    }
    
    // 开始执行任务
    runTask(task, category);
  }
};

/**
 * 执行单个任务
 */
const runTask = async (task: TaskRecord, category: TaskCategory): Promise<void> => {
  if (!taskService) return;
  
  const handler = handlers.get(task.type);
  if (!handler) return;

  // 增加并发计数
  runningCounts[category]++;
  runningTaskIds.add(task.id);

  // 标记开始执行
  taskService.updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: 0,
    markStarted: true,
  });

  const descriptor = generateTaskDescriptor(task.type, task.payload);
  logger.info(`开始执行: ${descriptor.title} (#${task.id})`);

  // 构建任务上下文
  const ctx: TaskContext = {
    task,
    updateProgress: (progress: number, stage?: string) => {
      taskService?.updateTaskStatus({
        id: task.id,
        status: "RUNNING",
        progress: Math.min(99, Math.max(0, progress)),
        detailProgress: stage ? { current: progress, total: 100, stage } : null,
      });
    },
    updateDetailProgress: (current: number, total: number, stage?: string) => {
      const progress = total > 0 ? Math.round((current / total) * 100) : 0;
      taskService?.updateTaskStatus({
        id: task.id,
        status: "RUNNING",
        progress: Math.min(99, Math.max(0, progress)),
        detailProgress: { current, total, stage },
      });
    },
    log: {
      debug: (msg) => logger.debug(`[Task#${task.id}] ${msg}`),
      info: (msg) => logger.info(`[Task#${task.id}] ${msg}`),
      warn: (msg) => logger.warn(`[Task#${task.id}] ${msg}`),
      error: (msg, err) => logger.error(`[Task#${task.id}] ${msg}`, err),
    },
    isCancelled: () => cancelledTaskIds.has(task.id),
    createChildTask: (type: string, payload: unknown) => {
      return taskService!.createTask({
        type,
        payload,
        parentTaskId: task.id,
        createdByUserId: task.created_by_user_id,
      });
    },
  };

  try {
    // 检测处理器签名：如果处理器期望 TaskRecord，则传入 task；否则传入 ctx
    // 通过检查处理器的参数数量来判断（旧版处理器只有一个参数）
    const handlerLength = handler.length;
    if (handlerLength === 1) {
      // 可能是旧版处理器，尝试传入 task
      // 由于 TypeScript 无法在运行时区分，我们统一传入 ctx，让旧处理器通过 ctx.task 访问
      // 但为了兼容，我们创建一个代理对象
      const legacyCompatibleArg = new Proxy(ctx, {
        get(target, prop) {
          // 如果访问的是 TaskRecord 的属性，从 task 中获取
          if (prop in task) {
            return (task as any)[prop];
          }
          // 否则从 ctx 中获取
          return (target as any)[prop];
        },
      });
      await (handler as any)(legacyCompatibleArg);
    } else {
      await (handler as any)(ctx);
    }

    // 检查是否被取消
    if (cancelledTaskIds.has(task.id)) {
      taskService.updateTaskStatus({
        id: task.id,
        status: "CANCELLED",
        errorMessage: "用户取消",
        markFinished: true,
      });
      logger.info(`任务已取消: ${descriptor.title} (#${task.id})`);
    } else {
      // 成功完成
      taskService.updateTaskStatus({
        id: task.id,
        status: "SUCCESS",
        progress: 100,
        markFinished: true,
      });
      logger.info(`任务完成: ${descriptor.title} (#${task.id})`);
    }
  } catch (err: any) {
    const errorMessage = typeof err?.message === "string" ? err.message : "任务执行失败";
    
    // 检查是否需要重试
    const currentTask = taskService.getTaskById(task.id);
    if (currentTask && currentTask.retry_count < currentTask.max_retries) {
      // 增加重试计数，延迟后重新入队
      taskService.incrementRetryCount(task.id);
      taskService.updateTaskStatus({
        id: task.id,
        status: "PENDING",
        errorMessage: `重试中 (${currentTask.retry_count + 1}/${currentTask.max_retries}): ${errorMessage}`,
      });
      logger.warn(`任务将重试: ${descriptor.title} (#${task.id}), 原因: ${errorMessage}`);
      
      // 延迟后触发重新处理
      setTimeout(() => notifyTaskCreated(), config.retryDelayMs);
    } else {
      // 超过重试次数，标记失败
      taskService.updateTaskStatus({
        id: task.id,
        status: "FAILED",
        errorMessage,
        markFinished: true,
      });
      logger.error(`任务失败: ${descriptor.title} (#${task.id}), 原因: ${errorMessage}`);
    }
  } finally {
    // 减少并发计数
    runningCounts[category]--;
    runningTaskIds.delete(task.id);
    cancelledTaskIds.delete(task.id);

    // 尝试处理更多任务
    setTimeout(() => tryProcessTasks(), 0);
  }
};

// 导出类型
export type { TaskHandler, TaskContext, TaskRecord } from "./types.ts";
