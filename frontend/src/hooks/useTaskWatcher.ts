import { getErrorMessage } from "@/lib/api/errors";
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

  const [state, setState] = useState<TaskWatcherState & { taskId: number | null }>({
    taskId,
    task: null,
    loading: !!taskId,
    error: null,
  });

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    let timer: number | null = null;

    const loadOnce = async () => {
      try {
        const res = await getTask(taskId);
        if (cancelled) return;
        setState({ taskId, task: res.task, loading: false, error: null });

        const done: TaskStatus[] = ["SUCCESS", "FAILED"];
        if (!done.includes(res.task.status)) {
          timer = window.setTimeout(loadOnce, intervalMs);
        }
      } catch (err) {
        if (cancelled) return;
        const message = getErrorMessage(err, "加载任务状态失败");
        setState((prev) => ({ taskId, task: prev.taskId === taskId ? prev.task : null, loading: false, error: message }));
        timer = window.setTimeout(loadOnce, intervalMs);
      }
    };

    loadOnce();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [taskId, intervalMs]);

  if (!taskId) return { task: null, loading: false, error: null };
  if (state.taskId !== taskId) return { task: null, loading: true, error: null };
  return { task: state.task, loading: state.loading, error: state.error };
};
