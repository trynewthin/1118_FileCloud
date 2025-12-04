import { listTasks, updateTaskStatus, type TaskRecord } from "../../modules/tasks/service.ts";
import type { TaskStatus } from "../../modules/tasks/service.ts";

// 任务处理函数类型，每个模块可以按需实现自己的任务处理逻辑
export type TaskHandler = (task: TaskRecord) => Promise<void> | void;

// 任务处理器注册表，以任务类型字符串为 key
const handlers = new Map<string, TaskHandler>();

// 注册任务处理器，在各业务模块初始化时调用
export const registerTaskHandler = (type: string, handler: TaskHandler) => {
  handlers.set(type, handler);
  console.log(`[TaskExecutor] 注册任务处理器: ${type}, 当前已注册: ${Array.from(handlers.keys()).join(", ")}`);
};

// 执行单个任务（由内部 worker 调用）
const runSingleTask = async (task: TaskRecord) => {
  console.log(`[TaskExecutor] 准备执行任务 ${task.id}, 类型: ${task.type}`);
  console.log(`[TaskExecutor] 当前 handlers: [${Array.from(handlers.keys()).join(", ")}]`);
  
  const handler = handlers.get(task.type);

  // 如果没有对应处理器，直接标记为失败，避免任务一直挂着
  if (!handler) {
    console.error(`[TaskExecutor] 未找到任务类型 ${task.type} 的处理器`);
    console.error(`[TaskExecutor] handlers Map size: ${handlers.size}, 已注册: [${Array.from(handlers.keys()).join(", ")}]`);
    updateTaskStatus({
      id: task.id,
      status: "FAILED",
      errorMessage: `未找到任务类型 ${task.type} 的处理器`,
      markStarted: true,
      markFinished: true,
    });
    return;
  }

  // 标记开始执行
  updateTaskStatus({
    id: task.id,
    status: "RUNNING",
    progress: 0,
    markStarted: true,
  });

  try {
    await handler(task);

    // 如果业务侧没有自己更新进度，这里兜底标记为 100% 完成
    updateTaskStatus({
      id: task.id,
      status: "SUCCESS",
      progress: 100,
      markFinished: true,
    });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "任务执行失败";
    updateTaskStatus({
      id: task.id,
      status: "FAILED",
      errorMessage: message,
      markFinished: true,
    });
  }
};

export interface TaskWorkerOptions {
  intervalMs?: number;
  batchSize?: number;
}

let workerStarted = false;

// 启动简单的轮询型任务 worker
// 注意：当前实现为单进程、串行执行任务，后续如需扩展多进程/多实例，需要增加锁或队列实现。
export const startTaskWorker = (options?: TaskWorkerOptions) => {
  if (workerStarted) return;
  workerStarted = true;

  const intervalMs = options?.intervalMs ?? 1000;
  const batchSize = options?.batchSize ?? 5;

  const tick = async () => {
    try {
      // 只取 PENDING 状态的任务，按创建时间倒序，简单处理前 batchSize 个
      const pending = listTasks({
        status: "PENDING",
        limit: batchSize,
        offset: 0,
      });

      for (const task of pending) {
        // 串行执行，避免复杂并发问题
        // 后续可考虑并发 Promise.all，但需要防止对同一任务的竞争更新
        // eslint-disable-next-line no-await-in-loop
        await runSingleTask(task);
      }
    } catch (err) {
      // 这里仅记录错误，避免 worker 停掉；可接入日志系统
      console.error("Task worker tick error", err);
    }
  };

  // 周期轮询
  setInterval(tick, intervalMs);
};
