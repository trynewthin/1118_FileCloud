import { apiClient, buildApiUrl, getAuthToken } from "./client";

export interface FileEntry {
  id: string;
  library_id: number;
  parent_id: string | null;
  is_directory: boolean;
  original_name: string;
  index_suffix: string | null;  // 已废弃，非侵入式索引不再使用
  extension: string | null;
  size_bytes: number;
  mime_type: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // 融合访问增强字段
  library_name?: string;
  library_online?: boolean;
  // 虚拟文件库条目标记（用于在根目录将文件库显示为文件夹）
  _isLibraryEntry?: boolean;
}

export interface TrashEntry extends FileEntry {
  relative_path: string;
}

export interface ListEntriesResponse {
  items: FileEntry[];
  library_online?: boolean;  // 库在线状态
}

export interface ListTrashResponse {
  items: TrashEntry[];
}

export interface GetEntryResponse {
  entry: FileEntry;
  ancestors?: { id: string; name: string }[];
  security:
    | { hasPassword: false }
    | {
        hasPassword: true;
        hint: string | null;
      };
}

export const listEntries = async (params: {
  libraryId: number;
  parentId?: string | null;
  password?: string;
}): Promise<ListEntriesResponse> => {
  const searchParams = new URLSearchParams();
  if (params.parentId) searchParams.set("parentId", params.parentId);
  if (params.password) searchParams.set("password", params.password);
  const qs = searchParams.toString();
  const path = `/files/library/${params.libraryId}/entries${qs ? `?${qs}` : ""}`;
  return apiClient.get<ListEntriesResponse>(path);
};

export const listTrashEntries = async (libraryId: number): Promise<ListTrashResponse> => {
  return apiClient.get<ListTrashResponse>(`/files/library/${libraryId}/trash`);
};

export const getEntry = async (id: string, password?: string): Promise<GetEntryResponse> => {
  const searchParams = new URLSearchParams();
  if (password) searchParams.set("password", password);
  const qs = searchParams.toString();
  const path = `/files/entries/${id}${qs ? `?${qs}` : ""}`;
  return apiClient.get<GetEntryResponse>(path);
};

export const downloadEntry = (id: string, password?: string, originalName?: string): string => {
  const searchParams = new URLSearchParams();
  if (password) searchParams.set("password", password);
  const token =
    getAuthToken() ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("filecloud_auth_token")
      : null);
  if (token) searchParams.set("token", token);
  const qs = searchParams.toString();
  // 返回下载 URL，前端可用于 window.open 或 a[href]
  const safeName = originalName ? encodeURIComponent(originalName) : undefined;
  const path = safeName
    ? `/files/entries/${id}/download/${safeName}`
    : `/files/entries/${id}/download`;
  return buildApiUrl(`${path}${qs ? `?${qs}` : ""}`);
};

export const setEntryPassword = async (
  id: string,
  params: { password: string; hint?: string },
): Promise<{ security: { hasPassword: true; hint: string | null } }> => {
  return apiClient.post<{ security: { hasPassword: true; hint: string | null } }>(
    `/files/entries/${id}/password`,
    params,
  );
};

export const clearEntryPassword = async (id: string): Promise<void> => {
  await apiClient.delete(`/files/entries/${id}/password`);
};

export type FileTaskResponse = { task: { id: number } };

export interface UploadResponse extends FileTaskResponse {
  uploaded: number;
}

export const deleteEntry = async (id: string, password?: string): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/delete`, { password });
};

export const restoreEntry = async (id: string): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/restore`);
};

export const destroyEntry = async (id: string): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/destroy`);
};

// 上传进度回调类型
export type UploadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percent: number;
}) => void;

// 带进度的文件上传
export const uploadFiles = async (params: {
  libraryId: number;
  parentId?: string | null;
  files: FileList;
  onProgress?: UploadProgressCallback;
}): Promise<UploadResponse> => {
  const form = new FormData();
  Array.from(params.files).forEach((file) => {
    form.append("files", file);
  });

  const searchParams = new URLSearchParams();
  if (params.parentId) searchParams.set("parentId", params.parentId);
  const qs = searchParams.toString();
  const path = `/files/library/${params.libraryId}/upload${qs ? `?${qs}` : ""}`;

  // 如果有进度回调，使用 XMLHttpRequest 以获取上传进度
  if (params.onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = buildApiUrl(path);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && params.onProgress) {
          params.onProgress({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            reject(new Error("响应解析失败"));
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText);
            reject(new Error(data.message || `上传失败 (${xhr.status})`));
          } catch {
            reject(new Error(`上传失败 (${xhr.status})`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("网络错误"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("上传已取消"));
      });

      xhr.open("POST", url);
      
      // 添加认证 token
      const token = getAuthToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.send(form);
    });
  }

  // 无进度回调时使用原有方式
  return apiClient.post<UploadResponse>(path, form);
};

export const renameEntry = async (
  id: string,
  params: { newName: string; password?: string },
): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/rename`, params);
};

export const moveEntry = async (
  id: string,
  params: { targetParentId?: string | null; password?: string },
): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/move`, params);
};

export const copyEntry = async (
  id: string,
  params: { targetParentId?: string | null; newName?: string; password?: string },
): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/copy`, params);
};

export const indexLibrary = async (
  libraryId: number,
  options?: { forceReindex?: boolean },
): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/library/${libraryId}/index`, options);
};

export const indexLibraryPath = async (
  libraryId: number,
  relativePath: string,
): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/library/${libraryId}/index-path`, {
    relativePath,
  });
};

// 新建文件夹
export const createFolder = async (params: {
  libraryId: number;
  parentId?: string | null;
  name: string;
}): Promise<{ message: string; entry: { id: string; name: string } }> => {
  return apiClient.post(`/files/library/${params.libraryId}/mkdir`, {
    parentId: params.parentId,
    name: params.name,
  });
};

// ============================================================================
// FTS5 全文搜索
// ============================================================================

export interface FileSearchResult {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  extension: string | null;
  rank?: number;
}

export interface SearchResponse {
  items: FileSearchResult[];
}

/**
 * 全文搜索文件和目录
 * 使用 FTS5 索引，支持中文分词和前缀匹配
 */
export const searchFiles = async (params: {
  libraryId: number;
  keyword: string;
  pathPrefix?: string;
  extension?: string;
  type?: "all" | "file" | "directory";
  limit?: number;
}): Promise<SearchResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.keyword);
  if (params.pathPrefix) searchParams.set("pathPrefix", params.pathPrefix);
  if (params.extension) searchParams.set("extension", params.extension);
  if (params.type) searchParams.set("type", params.type);
  if (params.limit) searchParams.set("limit", String(params.limit));
  
  const qs = searchParams.toString();
  const path = `/files/library/${params.libraryId}/search?${qs}`;
  return apiClient.get<SearchResponse>(path);
};

/**
 * 获取 FTS 索引统计信息
 */
export const getSearchStats = async (libraryId: number): Promise<{
  total: number;
  byLibrary: Record<number, number>;
}> => {
  return apiClient.get(`/files/library/${libraryId}/search/stats`);
};
