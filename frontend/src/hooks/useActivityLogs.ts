import { useAsyncData } from "./useAsyncData";
import { useEffect } from "react";
import type { ActivityLog } from "@/lib/api/activityLogs";
import { listActivityLogs } from "@/lib/api/activityLogs";


interface UseActivityLogsOptions {
  /** 是否自动加载，默认 true */
  auto?: boolean;
  /** 是否启用自动轮询，默认 true */
  autoRefresh?: boolean;
  /** 轮询间隔（毫秒），默认 5000 */
  refreshInterval?: number;
}

const fetchData = async () => {
  const res = await listActivityLogs();
  return { items: res.items };
};

// 管理操作日志列表的 hook
export const useActivityLogs = (options?: UseActivityLogsOptions) => {
  const { auto = true, autoRefresh = true, refreshInterval = 5000 } = options ?? {};
  
  const { state, load } = useAsyncData({ items: [] as ActivityLog[] }, fetchData, "加载操作日志失败", auto);


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
