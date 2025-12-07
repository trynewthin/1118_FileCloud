import { apiClient } from "./client";

export interface FileLibrary {
  id: number;
  root_path: string;
  display_name: string;
  capacity_limit_bytes: number | null;
  current_size_bytes: number;
  is_enabled: boolean;
  is_online: boolean;  // 库在线状态（后端返回 is_online）
  is_online_cached?: boolean;  // 兼容旧字段
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListFileLibrariesResponse {
  items: FileLibrary[];
}

export const listFileLibraries = async (): Promise<ListFileLibrariesResponse> => {
  return apiClient.get<ListFileLibrariesResponse>("/file-libraries");
};

export const createFileLibrary = async (params: {
  rootPath: string;
  displayName?: string;
  capacityLimitBytes?: number | null;
}): Promise<{ library: FileLibrary }> => {
  return apiClient.post<{ library: FileLibrary }>("/file-libraries", params);
};

export const updateFileLibrary = async (
  id: number,
  params: {
    displayName?: string;
    capacityLimitBytes?: number | null;
    isEnabled?: boolean;
  },
): Promise<{ library: FileLibrary }> => {
  return apiClient.request<{ library: FileLibrary }>(`/file-libraries/${id}`, {
    method: "PATCH",
    body: JSON.stringify(params),
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const deleteFileLibrary = async (id: number): Promise<void> => {
  await apiClient.delete(`/file-libraries/${id}`);
};

export const refreshFileLibrary = async (id: number): Promise<{ library: FileLibrary }> => {
  return apiClient.post<{ library: FileLibrary }>(`/file-libraries/${id}/refresh`);
};

// 文件库统计信息
export interface FileLibraryStats {
  libraryId: number;
  totalFiles: number;      // 文件总数
  totalFolders: number;    // 文件夹总数
  totalSizeBytes: number;  // 索引中记录的总大小
  diskSizeBytes: number;   // 磁盘实际大小
}

export const getFileLibraryStats = async (id: number): Promise<{ stats: FileLibraryStats }> => {
  return apiClient.get<{ stats: FileLibraryStats }>(`/file-libraries/${id}/stats`);
};
