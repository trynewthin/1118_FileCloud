import { apiClient } from "./client";

// ============================================================================
// 类型定义
// ============================================================================

export type TranscodeStatus = "pending" | "processing" | "completed" | "failed";

export interface TranscodeState {
  needsTranscode: boolean;
  status: TranscodeStatus | null;
  progress: number | null;
  hasTranscodedVersion: boolean;
  errorMessage?: string | null;
}

export interface StartTranscodeResponse {
  message: string;
  taskId: number;
}

// ============================================================================
// API 调用
// ============================================================================

// 获取文件的转码状态
export const getTranscodeState = async (entryId: string): Promise<TranscodeState> => {
  return apiClient.get<TranscodeState>(`/file-content/${entryId}/transcode`);
};

// 触发转码任务
export const startTranscode = async (entryId: string): Promise<StartTranscodeResponse> => {
  return apiClient.post<StartTranscodeResponse>(`/file-content/${entryId}/transcode`, {});
};

// 获取转码版本的播放 URL
export const getTranscodedStreamUrl = (entryId: string): string => {
  return `/api/file-content/${entryId}/stream/transcoded`;
};

// 获取原始版本的播放 URL
export const getOriginalStreamUrl = (entryId: string): string => {
  return `/api/file-content/${entryId}/stream`;
};
