import { useCallback, useEffect, useState } from "react";
import type { TaskRecord, TaskStatus } from "@/lib/api/tasks";
import { listTasks } from "@/lib/api/tasks";

interface TasksState {
  items: TaskRecord[];
  loading: boolean;
  error: string | null;
}

interface UseTasksOptions {
  status?: TaskStatus | "ALL";
  auto?: boolean;
}

// 管理任务列表及状态的 hook
export const useTasks = (options?: UseTasksOptions) => {
  const [state, setState] = useState<TasksState>({
    items: [],
    loading: !!options?.auto,
    error: null,
  });

  const [status, setStatus] = useState<TaskStatus | "ALL">(options?.status ?? "ALL");

  const load = useCallback(
    async (override?: { status?: TaskStatus | "ALL" }) => {
      const effectiveStatus = override?.status ?? status;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await listTasks({ status: effectiveStatus });
        setState({ items: res.items, loading: false, error: null });
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "加载任务失败";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [status],
  );

  useEffect(() => {
    if (!options?.auto) return;

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (cancelled) return;
      await load();
      if (cancelled) return;
      timer = window.setTimeout(tick, 3000);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [options?.auto, load]);

  const changeStatus = useCallback(
    async (next: TaskStatus | "ALL") => {
      setStatus(next);
      await load({ status: next });
    },
    [load],
  );

  return {
    ...state,
    status,
    reload: load,
    setStatus: changeStatus,
  };
};
