/**
 * 远程客户端管理 hook
 */

import { useCallback, useEffect, useState } from "react";
import { getRemoteClients, type RemoteClient } from "@/lib/api/remoteProxy";

interface RemoteClientsState {
  clients: RemoteClient[];
  loading: boolean;
  error: string | null;
}

export const useRemoteClients = (options?: { autoRefresh?: boolean; refreshInterval?: number }) => {
  const { autoRefresh = true, refreshInterval = 10000 } = options ?? {};

  const [state, setState] = useState<RemoteClientsState>({
    clients: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }
    try {
      const res = await getRemoteClients();
      setState({ clients: res.clients, loading: false, error: null });
    } catch (err: any) {
      // 如果是 404 或服务不可用，说明远程代理未启用，静默处理
      if (err?.status === 404 || err?.message?.includes("fetch")) {
        setState({ clients: [], loading: false, error: null });
      } else {
        const message = typeof err?.message === "string" ? err.message : "加载远程客户端失败";
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    }
  }, []);

  // 初始加载
  useEffect(() => {
    load();
  }, [load]);

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
