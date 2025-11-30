import { useCallback, useEffect, useState } from "react";
import type { ActivityLog } from "@/lib/api/activityLogs";
import { listActivityLogs } from "@/lib/api/activityLogs";

interface ActivityLogsState {
  items: ActivityLog[];
  loading: boolean;
  error: string | null;
}

interface UseActivityLogsOptions {
  /** 是否自动加载，默认 true */
  auto?: boolean;
  /** 是否启用自动轮询，默认 true */
  autoRefresh?: boolean;
  /** 轮询间隔（毫秒），默认 5000 */
  refreshInterval?: number;
}

// 管理操作日志列表的 hook
export const useActivityLogs = (options?: UseActivityLogsOptions) => {
  const { auto = true, autoRefresh = true, refreshInterval = 5000 } = options ?? {};
  
  const [state, setState] = useState<ActivityLogsState>({
    items: [],
    loading: auto,
    error: null,
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }
    try {
      const res = await listActivityLogs();
      setState({ items: res.items, loading: false, error: null });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载操作日志失败";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  // 初始加载
  useEffect(() => {
    if (auto) {
      load();
    }
  }, [auto, load]);

  // 自动轮询
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      load(true);
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, load]);

  return {
    ...state,
    reload: load,
  };
};
