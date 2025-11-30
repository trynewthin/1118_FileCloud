import { apiClient } from "./client";

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

// 详细进度信息
export interface DetailProgress {
  current: number;
  total: number;
  label?: string;
}

export interface TaskRecord {
  id: number;
  parent_task_id: number | null;
  type: string;
  payload: unknown;
  status: TaskStatus;
  progress: number;
  detail_progress: DetailProgress | null;
  error_message: string | null;
  created_by_user_id: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  // 子任务列表（仅在查询时填充）
  children?: TaskRecord[];
}

export interface ListTasksResponse {
  items: TaskRecord[];
}

export const listTasks = async (params?: {
  limit?: number;
  offset?: number;
  status?: TaskStatus | "ALL";
  includeChildren?: boolean;
}): Promise<ListTasksResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params?.status) searchParams.set("status", params.status);
  if (params?.includeChildren) searchParams.set("includeChildren", "true");
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

// 删除/取消任务
export const deleteTask = async (id: number): Promise<void> => {
  await apiClient.delete(`/tasks/${id}`);
};
