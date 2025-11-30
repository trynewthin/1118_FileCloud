import { useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import {
  createFileLibrary,
  deleteFileLibrary,
  listFileLibraries,
  refreshFileLibrary,
  updateFileLibrary,
} from "@/lib/api/fileLibraries";

interface FileLibrariesState {
  items: FileLibrary[];
  loading: boolean;
  error: string | null;
}

interface UseFileLibrariesOptions {
  /** 是否启用自动轮询，默认 true */
  autoRefresh?: boolean;
  /** 轮询间隔（毫秒），默认 5000 */
  refreshInterval?: number;
}

// 管理文件库列表及相关操作的 hook
export const useFileLibraries = (options?: UseFileLibrariesOptions) => {
  const { autoRefresh = true, refreshInterval = 5000 } = options ?? {};
  
  const [state, setState] = useState<FileLibrariesState>({
    items: [],
    loading: true,
    error: null,
  });

  // 用于静默刷新，不显示 loading 状态
  const isFirstLoad = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }
    try {
      const res = await listFileLibraries();
      setState({ items: res.items, loading: false, error: null });
      isFirstLoad.current = false;
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载文件库失败";
      setState((prev) => ({ ...prev, loading: false, error: message }));
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

  return {
    ...state,
    reload: load,
    create,
    update,
    remove,
    refresh,
  };
};
