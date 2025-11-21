import { apiClient } from "./client";

export const apiGetInitStatus = async (): Promise<{ initialized: boolean }> => {
  return apiClient.get<{ initialized: boolean }>("/auth/init-status");
};
