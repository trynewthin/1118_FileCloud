import { apiClient } from "./client";

export interface ActivityLog {
  id: number;
  actor_user_id: number | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: unknown;
  created_at: string;
}

export interface ListActivityLogsResponse {
  items: ActivityLog[];
}

export const listActivityLogs = async (params?: {
  limit?: number;
  offset?: number;
  action?: string;
  actorUserId?: number;
}): Promise<ListActivityLogsResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params?.action) searchParams.set("action", params.action);
  if (params?.actorUserId !== undefined)
    searchParams.set("actorUserId", String(params.actorUserId));
  const qs = searchParams.toString();
  const path = `/activity-logs${qs ? `?${qs}` : ""}`;
  return apiClient.get<ListActivityLogsResponse>(path);
};
