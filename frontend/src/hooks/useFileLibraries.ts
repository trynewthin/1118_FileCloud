import { useCallback, useEffect, useState } from "react";
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

// 管理文件库列表及相关操作的 hook
export const useFileLibraries = () => {
  const [state, setState] = useState<FileLibrariesState>({
    items: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await listFileLibraries();
      setState({ items: res.items, loading: false, error: null });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载文件库失败";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
