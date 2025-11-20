import { useCallback, useEffect, useState } from "react";
import type { ActivityLog } from "@/lib/api/activityLogs";
import { listActivityLogs } from "@/lib/api/activityLogs";

interface ActivityLogsState {
  items: ActivityLog[];
  loading: boolean;
  error: string | null;
}

interface UseActivityLogsOptions {
  auto?: boolean;
}

// 管理操作日志列表的 hook
export const useActivityLogs = (options?: UseActivityLogsOptions) => {
  const [state, setState] = useState<ActivityLogsState>({
    items: [],
    loading: !!options?.auto,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await listActivityLogs();
      setState({ items: res.items, loading: false, error: null });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载操作日志失败";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    if (options?.auto) {
      load();
    }
  }, [options?.auto, load]);

  return {
    ...state,
    reload: load,
  };
};
