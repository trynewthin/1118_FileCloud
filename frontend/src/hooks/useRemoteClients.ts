import { useAsyncData } from "./useAsyncData";
import { getErrorMessage, getErrorStatus } from "@/lib/api/errors";
/**
 * 远程客户端管理 hook
 */

import { useEffect } from "react";
import { getRemoteClients, type RemoteClient } from "@/lib/api/remoteProxy";


const fetchData = async () => {
  try {
    const res = await getRemoteClients();
    return { clients: res.clients };
  } catch (error) {
    if (getErrorStatus(error) === 404 || getErrorMessage(error, "").includes("fetch")) {
      return { clients: [] as RemoteClient[] };
    }
    throw error;
  }
};

export const useRemoteClients = (options?: { autoRefresh?: boolean; refreshInterval?: number }) => {
  const { autoRefresh = true, refreshInterval = 10000 } = options ?? {};

  const { state, load } = useAsyncData({ clients: [] as RemoteClient[] }, fetchData, "加载远程客户端失败", true);


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
