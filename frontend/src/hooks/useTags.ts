import { useState, useEffect, useCallback } from "react";
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getTagsForEntry,
  addTagToEntry,
  removeTagFromEntry,
  setPrimaryTag,
  type FileTag,
  type FileTagEntry,
  type CreateTagInput,
  type UpdateTagInput,
} from "../lib/api/tags";

// ============================================================================
// 标签列表管理 Hook
// ============================================================================

export const useTagList = () => {
  const [tags, setTags] = useState<FileTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTags();
      setTags(data);
    } catch (err: any) {
      setError(err.message || "加载标签失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(async (input: CreateTagInput) => {
    const tag = await createTag(input);
    await reload();
    return tag;
  }, [reload]);

  const update = useCallback(async (id: number, input: UpdateTagInput) => {
    const tag = await updateTag(id, input);
    await reload();
    return tag;
  }, [reload]);

  const remove = useCallback(async (id: number) => {
    await deleteTag(id);
    await reload();
  }, [reload]);

  return {
    tags,
    loading,
    error,
    reload,
    create,
    update,
    remove,
  };
};

// ============================================================================
// 文件标签管理 Hook
// ============================================================================

export const useEntryTags = (entryId: string | null) => {
  const [tags, setTags] = useState<FileTagEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!entryId) {
      setTags([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await getTagsForEntry(entryId);
      setTags(data);
    } catch (err: any) {
      setError(err.message || "加载文件标签失败");
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addTag = useCallback(async (tagId: number, isPrimary: boolean = false) => {
    if (!entryId) return;
    await addTagToEntry(entryId, tagId, isPrimary);
    await reload();
  }, [entryId, reload]);

  const removeTag = useCallback(async (tagId: number) => {
    if (!entryId) return;
    await removeTagFromEntry(entryId, tagId);
    await reload();
  }, [entryId, reload]);

  const setAsPrimary = useCallback(async (tagId: number) => {
    if (!entryId) return;
    await setPrimaryTag(entryId, tagId);
    await reload();
  }, [entryId, reload]);

  // 获取主标签
  const primaryTag = tags.find((t) => t.is_primary)?.tag ?? null;

  return {
    tags,
    primaryTag,
    loading,
    error,
    reload,
    addTag,
    removeTag,
    setAsPrimary,
  };
};

// ============================================================================
// 辅助函数
// ============================================================================

// 将树形标签扁平化
export const flattenTags = (tags: FileTag[]): FileTag[] => {
  const result: FileTag[] = [];
  
  const traverse = (tagList: FileTag[]) => {
    for (const tag of tagList) {
      result.push(tag);
      if (tag.children && tag.children.length > 0) {
        traverse(tag.children);
      }
    }
  };
  
  traverse(tags);
  return result;
};

// 获取标签的完整路径名称
export const getTagPath = (tag: FileTag, allTags: FileTag[]): string => {
  const flatTags = flattenTags(allTags);
  const parts: string[] = [tag.name];
  
  let current = tag;
  while (current.parent_tag_id !== null) {
    const parent = flatTags.find((t) => t.id === current.parent_tag_id);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  
  return parts.join(" / ");
};
