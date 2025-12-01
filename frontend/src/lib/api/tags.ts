import { apiClient } from "./client";

// ============================================================================
// 类型定义
// ============================================================================

export interface FileTag {
  id: number;
  name: string;
  parent_tag_id: number | null;
  level: number;
  color: string | null;
  allow_multiple: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  children?: FileTag[];
  entry_count?: number;
}

export interface FileTagEntry {
  id: number;
  tag_id: number;
  entry_id: string;
  is_primary: boolean;
  created_at: string;
  tag: FileTag;
}

// ============================================================================
// 标签 CRUD API
// ============================================================================

// 获取所有标签（树形结构，带统计信息）
export const listTags = async (): Promise<FileTag[]> => {
  const res = await apiClient.get<{ tags: FileTag[] }>("/tags");
  return res.tags;
};

// 获取指定父标签下的子标签
export const listChildTags = async (parentId?: number | null): Promise<FileTag[]> => {
  const query = parentId ? `?parentId=${parentId}` : "";
  const res = await apiClient.get<{ tags: FileTag[] }>(`/tags/children${query}`);
  return res.tags;
};

// 获取单个标签详情
export const getTag = async (id: number): Promise<FileTag> => {
  const res = await apiClient.get<{ tag: FileTag }>(`/tags/${id}`);
  return res.tag;
};

// 创建标签
export interface CreateTagInput {
  name: string;
  parentTagId?: number | null;
  color?: string | null;
  allowMultiple?: boolean;
  sortOrder?: number;
}

export const createTag = async (input: CreateTagInput): Promise<FileTag> => {
  const res = await apiClient.post<{ tag: FileTag }>("/tags", input);
  return res.tag;
};

// 更新标签
export interface UpdateTagInput {
  name?: string;
  color?: string | null;
  allowMultiple?: boolean;
  sortOrder?: number;
}

export const updateTag = async (id: number, input: UpdateTagInput): Promise<FileTag> => {
  const res = await apiClient.put<{ tag: FileTag }>(`/tags/${id}`, input);
  return res.tag;
};

// 删除标签
export const deleteTag = async (id: number): Promise<void> => {
  await apiClient.delete(`/tags/${id}`);
};

// ============================================================================
// 文件-标签关联 API
// ============================================================================

// 获取文件的所有标签
export const getTagsForEntry = async (entryId: string): Promise<FileTagEntry[]> => {
  const res = await apiClient.get<{ tags: FileTagEntry[] }>(`/tags/entry/${entryId}`);
  return res.tags;
};

// 获取标签下的所有文件 ID
export const getEntriesForTag = async (tagId: number, includeChildren: boolean = false): Promise<string[]> => {
  const res = await apiClient.get<{ entryIds: string[] }>(`/tags/${tagId}/entries?includeChildren=${includeChildren}`);
  return res.entryIds;
};

// 给文件添加标签
export const addTagToEntry = async (entryId: string, tagId: number, isPrimary: boolean = false): Promise<void> => {
  await apiClient.post(`/tags/entry/${entryId}/add`, { tagId, isPrimary });
};

// 从文件移除标签
export const removeTagFromEntry = async (entryId: string, tagId: number): Promise<void> => {
  await apiClient.post(`/tags/entry/${entryId}/remove`, { tagId });
};

// 设置文件的主标签
export const setPrimaryTag = async (entryId: string, tagId: number): Promise<void> => {
  await apiClient.post(`/tags/entry/${entryId}/primary`, { tagId });
};

// 清除文件的主标签
export const clearPrimaryTag = async (entryId: string): Promise<void> => {
  await apiClient.delete(`/tags/entry/${entryId}/primary`);
};

// 批量给文件添加标签
export const addTagToEntries = async (tagId: number, entryIds: string[]): Promise<void> => {
  await apiClient.post(`/tags/${tagId}/batch-add`, { entryIds });
};

// 批量从文件移除标签
export const removeTagFromEntries = async (tagId: number, entryIds: string[]): Promise<void> => {
  await apiClient.post(`/tags/${tagId}/batch-remove`, { entryIds });
};
