/**
 * 统一文件访问 API
 * 提供跨库的文件访问接口，淡化库的存在
 */
import { apiClient } from "./client";
import type { FileEntry } from "./files";

// 库状态信息
export interface LibraryStatus {
  id: number;
  display_name: string;
  root_path: string;
  is_enabled: boolean;
  is_online: boolean;
  last_check_at: string | null;
}

// 统一文件条目（包含库信息）
export interface UnifiedFileEntry extends FileEntry {
  library_name: string;
  library_online: boolean;
}

// 分页信息
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

// 统一文件列表响应
export interface UnifiedEntriesResponse {
  items: UnifiedFileEntry[];
  libraries: LibraryStatus[];
  pagination: Pagination;
}

// 库状态响应
export interface LibrariesStatusResponse {
  libraries: LibraryStatus[];
  check_interval_ms: number;
}

// 搜索响应
export interface UnifiedSearchResponse {
  items: UnifiedFileEntry[];
  libraries: LibraryStatus[];
}

/**
 * 获取所有文件库的状态
 */
export const getLibrariesStatus = async (): Promise<LibrariesStatusResponse> => {
  return apiClient.get<LibrariesStatusResponse>("/entries/libraries/status");
};

/**
 * 统一文件列表
 * 跨库查询文件，支持分页和过滤
 */
export const listUnifiedEntries = async (params?: {
  parentId?: string | null;
  libraryIds?: number[];
  includeOffline?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<UnifiedEntriesResponse> => {
  const searchParams = new URLSearchParams();
  
  if (params?.parentId) {
    searchParams.set("parentId", params.parentId);
  }
  if (params?.libraryIds && params.libraryIds.length > 0) {
    searchParams.set("libraryIds", params.libraryIds.join(","));
  }
  if (params?.includeOffline !== undefined) {
    searchParams.set("includeOffline", String(params.includeOffline));
  }
  if (params?.page) {
    searchParams.set("page", String(params.page));
  }
  if (params?.pageSize) {
    searchParams.set("pageSize", String(params.pageSize));
  }
  
  const qs = searchParams.toString();
  const path = `/entries${qs ? `?${qs}` : ""}`;
  return apiClient.get<UnifiedEntriesResponse>(path);
};

/**
 * 跨库搜索
 */
export const searchUnifiedEntries = async (params: {
  keyword: string;
  libraryIds?: number[];
  type?: "all" | "file" | "directory";
  limit?: number;
}): Promise<UnifiedSearchResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.keyword);
  
  if (params.libraryIds && params.libraryIds.length > 0) {
    searchParams.set("libraryIds", params.libraryIds.join(","));
  }
  if (params.type) {
    searchParams.set("type", params.type);
  }
  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }
  
  const qs = searchParams.toString();
  return apiClient.get<UnifiedSearchResponse>(`/entries/search?${qs}`);
};
