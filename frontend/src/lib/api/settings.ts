import { apiClient } from "./client";

export interface SystemSetting {
  key: string;
  value: string;
}

export const listSettings = async (): Promise<{ items: SystemSetting[] }> => {
  return apiClient.get<{ items: SystemSetting[] }>("/settings");
};

export const updateSetting = async (key: string, value: string | number | boolean): Promise<void> => {
  await apiClient.put(`/settings/${encodeURIComponent(key)}`, { value });
};

// 获取单个设置值
export const getSetting = async (key: string): Promise<string | null> => {
  const res = await apiClient.get<{ key: string; value: string | null }>(`/settings/${encodeURIComponent(key)}`);
  return res.value;
};
