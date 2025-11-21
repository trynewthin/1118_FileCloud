import { useCallback, useEffect, useMemo, useState } from "react";
import type { FileEntry, FileTaskResponse } from "@/lib/api/files";
import {
  copyEntry as apiCopyEntry,
  deleteEntry as apiDeleteEntry,
  destroyEntry as apiDestroyEntry,
  getEntry,
  indexLibrary as apiIndexLibrary,
  indexLibraryPath as apiIndexLibraryPath,
  listEntries,
  moveEntry as apiMoveEntry,
  renameEntry as apiRenameEntry,
  restoreEntry as apiRestoreEntry,
} from "@/lib/api/files";

interface FileBrowserState {
  entries: FileEntry[];
  ancestors: { id: string; name: string }[];
  loading: boolean;
  error: string | null;
}

interface UseFileBrowserOptions {
  libraryId: number | null;
}

interface FileBrowserOperations {
  rename: (id: string, newName: string, password?: string) => Promise<FileTaskResponse>;
  move: (
    id: string,
    params: { targetParentId?: string | null; password?: string },
  ) => Promise<FileTaskResponse>;
  copy: (
    id: string,
    params: { targetParentId?: string | null; newName?: string; password?: string },
  ) => Promise<FileTaskResponse>;
  remove: (id: string, password?: string) => Promise<FileTaskResponse>;
  restore: (id: string) => Promise<FileTaskResponse>;
  destroy: (id: string) => Promise<FileTaskResponse>;
  indexLibrary: () => Promise<FileTaskResponse | null>;
  indexPath: (relativePath: string) => Promise<FileTaskResponse | null>;
}

interface UseFileBrowserResult extends FileBrowserState, FileBrowserOperations {
  libraryId: number | null;
  currentParentId: string | null;
  setCurrentParentId: (parentId: string | null) => void;
  getCachedPassword: (entryId: string) => string | undefined;
  setCachedPassword: (entryId: string, password: string) => void;
  clearCachedPassword: (entryId?: string) => void;
  reload: () => Promise<void>;
}

// 仅在内存中缓存条目的访问密码，用于简化后续请求
const createPasswordCache = () => {
  const map = new Map<string, string>();

  return {
    get(entryId: string): string | undefined {
      return map.get(entryId);
    },
    set(entryId: string, password: string) {
      map.set(entryId, password);
    },
    clear(entryId?: string) {
      if (entryId) {
        map.delete(entryId);
      } else {
        map.clear();
      }
    },
  };
};

const passwordCache = createPasswordCache();

// 文件浏览 hook：管理当前库/目录、列表加载和常用文件操作
export const useFileBrowser = (options: UseFileBrowserOptions): UseFileBrowserResult => {
  const { libraryId } = options;

  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [state, setState] = useState<FileBrowserState>({
    entries: [],
    ancestors: [],
    loading: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!libraryId) {
      setState({ entries: [], ancestors: [], loading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const cachedPwd = currentParentId ? passwordCache.get(currentParentId) : undefined;

      // 并行加载列表和面包屑（如果有 parentId）
      const listPromise = listEntries({
        libraryId,
        parentId: currentParentId,
        password: cachedPwd,
      });

      let ancestors: { id: string; name: string }[] = [];

      // 只有在进入非根目录时才需要去 fetch 详情以获取 ancestors
      if (currentParentId) {
        // 注意：这里的 getEntry 可能会因为密码保护失败，但如果 cachedPwd 正确则没问题
        // 实际中 listEntries 和 getEntry 可能需要共享错误处理逻辑
        try {
          const detail = await getEntry(currentParentId, cachedPwd);
          if (detail.ancestors) {
            ancestors = [...detail.ancestors, { id: detail.entry.id, name: detail.entry.original_name }];
          }
        } catch (err) {
          // 如果获取详情失败（比如密码不对），可能无法构建面包屑，但这不应阻塞列表显示（或者应该阻塞？）
          // 这里简单处理：忽略详情获取失败，只显示列表（如果列表也失败，会在下面 catch）
          console.error("Failed to fetch directory details for breadcrumbs", err);
        }
      }

      const res = await listPromise;
      setState({ entries: res.items, ancestors, loading: false, error: null });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载文件列表失败";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [libraryId, currentParentId]);

  useEffect(() => {
    // 切换库或 parent 时重新加载
    load();
  }, [load]);

  const wrapTask = useCallback(
    async <T extends FileTaskResponse | null>(fn: () => Promise<T>): Promise<T> => {
      try {
        const result = await fn();
        // 操作成功后刷新列表
        await load();
        return result;
      } catch (err) {
        // 这里不处理错误，只让上层自己决定如何提示
        throw err;
      }
    },
    [load],
  );

  const ops: FileBrowserOperations = useMemo(
    () => ({
      rename: (id, newName, password) =>
        wrapTask(() => apiRenameEntry(id, { newName, password })),
      move: (id, params) => wrapTask(() => apiMoveEntry(id, params)),
      copy: (id, params) => wrapTask(() => apiCopyEntry(id, params)),
      remove: (id, password) => wrapTask(() => apiDeleteEntry(id, password)),
      restore: (id) => wrapTask(() => apiRestoreEntry(id)),
      destroy: (id) => wrapTask(() => apiDestroyEntry(id)),
      indexLibrary: () =>
        libraryId ? wrapTask(() => apiIndexLibrary(libraryId)) : Promise.resolve(null),
      indexPath: (relativePath: string) =>
        libraryId
          ? wrapTask(() => apiIndexLibraryPath(libraryId, relativePath))
          : Promise.resolve(null),
    }),
    [wrapTask, libraryId],
  );

  return {
    ...state,
    libraryId,
    currentParentId,
    setCurrentParentId,
    getCachedPassword: (entryId: string) => passwordCache.get(entryId),
    setCachedPassword: (entryId: string, password: string) => {
      passwordCache.set(entryId, password);
    },
    clearCachedPassword: (entryId?: string) => {
      passwordCache.clear(entryId);
    },
    reload: load,
    ...ops,
  };
};
