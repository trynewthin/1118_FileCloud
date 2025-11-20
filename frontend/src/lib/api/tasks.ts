import { apiClient } from "./client";

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

export interface TaskRecord {
  id: number;
  type: string;
  payload: unknown;
  status: TaskStatus;
  progress: number;
  error_message: string | null;
  created_by_user_id: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ListTasksResponse {
  items: TaskRecord[];
}

export const listTasks = async (params?: {
  limit?: number;
  offset?: number;
  status?: TaskStatus | "ALL";
}): Promise<ListTasksResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params?.status) searchParams.set("status", params.status);
  const qs = searchParams.toString();
  const path = `/tasks${qs ? `?${qs}` : ""}`;
  return apiClient.get<ListTasksResponse>(path);
};

export const getTask = async (id: number): Promise<{ task: TaskRecord }> => {
  return apiClient.get<{ task: TaskRecord }>(`/tasks/${id}`);
};

export const createTask = async (params: {
  type: string;
  payload?: unknown;
}): Promise<{ task: TaskRecord }> => {
  return apiClient.post<{ task: TaskRecord }>("/tasks", params);
};
