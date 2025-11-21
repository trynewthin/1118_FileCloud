import { apiClient, buildApiUrl, getAuthToken } from "./client";

export interface FileEntry {
  id: string;
  library_id: number;
  parent_id: string | null;
  is_directory: boolean;
  original_name: string;
  extension: string | null;
  size_bytes: number;
  mime_type: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrashEntry extends FileEntry {
  relative_path: string;
}

export interface ListEntriesResponse {
  items: FileEntry[];
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

export const downloadEntry = (id: string, password?: string): string => {
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
  return buildApiUrl(`/files/entries/${id}/download${qs ? `?${qs}` : ""}`);
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

export const deleteEntry = async (id: string, password?: string): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/delete`, { password });
};

export const restoreEntry = async (id: string): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/restore`);
};

export const destroyEntry = async (id: string): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/entries/${id}/destroy`);
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

export const indexLibrary = async (libraryId: number): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/library/${libraryId}/index`);
};

export const indexLibraryPath = async (
  libraryId: number,
  relativePath: string,
): Promise<FileTaskResponse> => {
  return apiClient.post<FileTaskResponse>(`/files/library/${libraryId}/index-path`, {
    relativePath,
  });
};
