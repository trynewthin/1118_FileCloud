import { apiClient } from "./client";

// 查询是否允许注册
export const apiGetRegisterStatus = async (): Promise<{ allowed: boolean }> => {
  return apiClient.get<{ allowed: boolean }>("/auth/register-status");
};
