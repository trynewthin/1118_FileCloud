import { useAsyncData } from "./useAsyncData";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { FileLibrary, FileLibraryStats } from "@/lib/api/fileLibraries";
import {
  createFileLibrary,
  deleteFileLibrary,
  listFileLibraries,
  refreshFileLibrary,
  updateFileLibrary,
  getFileLibraryStats,
} from "@/lib/api/fileLibraries";
import { indexLibrary } from "@/lib/api/files";


interface UseFileLibrariesOptions {
  /** 是否启用自动轮询，默认 true */
  autoRefresh?: boolean;
  /** 轮询间隔（毫秒），默认 5000 */
  refreshInterval?: number;
}

const fetchData = async () => {
  const res = await listFileLibraries();
  return { items: res.items };
};

// 管理文件库列表及相关操作的 hook
export const useFileLibraries = (options?: UseFileLibrariesOptions) => {
  const { autoRefresh = true, refreshInterval = 5000 } = options ?? {};
  
  const { state, load } = useAsyncData({ items: [] as FileLibrary[] }, fetchData, "加载文件库失败", true);


  // 自动轮询
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      // 静默刷新，不显示 loading
      load(true);
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, load]);

  const create = useCallback(
    async (params: { rootPath: string; displayName?: string; capacityLimitBytes?: number | null }) => {
      await createFileLibrary(params);
      await load();
    },
    [load],
  );

  const update = useCallback(
    async (
      id: number,
      params: { displayName?: string; capacityLimitBytes?: number | null; isEnabled?: boolean },
    ) => {
      await updateFileLibrary(id, params);
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: number) => {
      await deleteFileLibrary(id);
      toast.success("文件库已删除");
      await load();
    },
    [load],
  );

  const refresh = useCallback(
    async (id: number) => {
      await refreshFileLibrary(id);
      await load();
    },
    [load],
  );

  // 获取文件库统计信息
  const getStats = useCallback(
    async (id: number): Promise<FileLibraryStats> => {
      const res = await getFileLibraryStats(id);
      return res.stats;
    },
    [],
  );

  // 重建文件库索引
  const reindex = useCallback(
    async (id: number, forceReindex = true) => {
      await indexLibrary(id, { forceReindex });
      toast.success("索引任务已创建，请在任务中心查看进度");
    },
    [],
  );

  return {
    ...state,
    reload: load,
    create,
    update,
    remove,
    refresh,
    getStats,
    reindex,
  };
};
