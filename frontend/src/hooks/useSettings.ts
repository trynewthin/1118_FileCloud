import { useAsyncData } from "./useAsyncData";
import { useCallback } from "react";
import type { SystemSetting } from "@/lib/api/settings";
import { listSettings, updateSetting } from "@/lib/api/settings";


const fetchData = async () => {
  const res = await listSettings();
  return { items: res.items };
};

// 管理系统设置的 hook
export const useSettings = () => {
  const { state, load } = useAsyncData({ items: [] as SystemSetting[] }, fetchData, "加载系统设置失败", true);


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
