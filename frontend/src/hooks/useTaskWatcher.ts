import { useEffect, useState } from "react";
import type { TaskRecord, TaskStatus } from "@/lib/api/tasks";
import { getTask } from "@/lib/api/tasks";

interface UseTaskWatcherOptions {
  taskId: number | null;
  intervalMs?: number;
}

interface TaskWatcherState {
  task: TaskRecord | null;
  loading: boolean;
  error: string | null;
}

// 简单的任务轮询 hook：用于监听单个任务状态变化
export const useTaskWatcher = (options: UseTaskWatcherOptions): TaskWatcherState => {
  const { taskId, intervalMs = 1000 } = options;

  const [state, setState] = useState<TaskWatcherState>({
    task: null,
    loading: !!taskId,
    error: null,
  });

  useEffect(() => {
    if (!taskId) {
      setState({ task: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    const loadOnce = async () => {
      try {
        const res = await getTask(taskId);
        if (cancelled) return;
        setState({ task: res.task, loading: false, error: null });

        const done: TaskStatus[] = ["SUCCESS", "FAILED"];
        if (!done.includes(res.task.status)) {
          timer = window.setTimeout(loadOnce, intervalMs);
        }
      } catch (err: any) {
        if (cancelled) return;
        const message = typeof err?.message === "string" ? err.message : "加载任务状态失败";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        timer = window.setTimeout(loadOnce, intervalMs);
      }
    };

    setState((prev) => ({ ...prev, loading: true, error: null }));
    loadOnce();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [taskId, intervalMs]);

  return state;
};
