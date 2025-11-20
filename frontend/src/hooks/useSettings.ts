import { useCallback, useEffect, useState } from "react";
import type { SystemSetting } from "@/lib/api/settings";
import { listSettings, updateSetting } from "@/lib/api/settings";

interface SettingsState {
  items: SystemSetting[];
  loading: boolean;
  error: string | null;
}

// 管理系统设置的 hook
export const useSettings = () => {
  const [state, setState] = useState<SettingsState>({
    items: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await listSettings();
      setState({ items: res.items, loading: false, error: null });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载系统设置失败";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async (key: string, value: string | number | boolean) => {
      await updateSetting(key, value);
      await load();
    },
    [load],
  );

  return {
    ...state,
    reload: load,
    update,
  };
};
