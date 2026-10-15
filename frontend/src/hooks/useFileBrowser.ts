import { useAsyncData } from "./useAsyncData";
import { useCallback, useMemo, useState } from "react";
import type { FileEntry, FileTaskResponse, UploadResponse, UploadProgressCallback, MoveEntryParams, CopyEntryParams } from "@/lib/api/files";
import { getTask } from "@/lib/api/tasks";
import {
  copyEntry as apiCopyEntry,
  createFolder as apiCreateFolder,
  deleteEntry as apiDeleteEntry,
  destroyEntry as apiDestroyEntry,
  getEntry,
  indexLibrary as apiIndexLibrary,
  indexLibraryPath as apiIndexLibraryPath,
  listEntries,
  moveEntry as apiMoveEntry,
  renameEntry as apiRenameEntry,
  restoreEntry as apiRestoreEntry,
  uploadFiles,
} from "@/lib/api/files";

interface FileBrowserState {
  entries: FileEntry[];
  ancestors: { id: string; name: string }[];
  loading: boolean;
  error: string | null;
  libraryOnline: boolean;  // 库在线状态
}

interface UseFileBrowserOptions {
  libraryId: number | null;
  parentId?: string | null;
}

interface FileBrowserOperations {
  rename: (id: string, newName: string, password?: string) => Promise<FileTaskResponse>;
  move: (
    id: string,
    params: MoveEntryParams,
  ) => Promise<FileTaskResponse>;
  copy: (
    id: string,
    params: CopyEntryParams,
  ) => Promise<FileTaskResponse>;
  remove: (id: string, password?: string) => Promise<FileTaskResponse>;
  restore: (id: string) => Promise<FileTaskResponse>;
  destroy: (id: string) => Promise<FileTaskResponse>;
  upload: (files: FileList, parentId: string | null, onProgress?: UploadProgressCallback) => Promise<UploadResponse>;
  createFolder: (name: string, parentId: string | null) => Promise<{ message: string; entry: { id: string; name: string } }>;
  indexLibrary: (options?: { forceReindex?: boolean }) => Promise<FileTaskResponse | null>;
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

  const [localParentId, setCurrentParentId] = useState<string | null>(null);
  const currentParentId = options.parentId !== undefined ? options.parentId : localParentId;
  const fetchData = useCallback(async () => {
    if (!libraryId) {
      return { entries: [], ancestors: [], libraryOnline: true };
    }

    const cachedPwd = currentParentId ? passwordCache.get(currentParentId) : undefined;

    // Attach rejection handlers to both parallel requests immediately.
    const [res, ancestors] = await Promise.all([
      listEntries({ libraryId, parentId: currentParentId, password: cachedPwd }),
      currentParentId
        ? getEntry(currentParentId, cachedPwd).then(
            (detail) => detail.ancestors
              ? [...detail.ancestors, { id: detail.entry.id, name: detail.entry.original_name }]
              : [],
            (error: unknown) => {
              console.error("Failed to fetch directory details for breadcrumbs", error);
              return [];
            },
          )
        : Promise.resolve([]),
    ]);

    return {
      entries: res.items,
      ancestors,
      libraryOnline: res.library_online ?? true,
    };
  }, [libraryId, currentParentId]);

  const { state, load } = useAsyncData(
    { entries: [] as FileEntry[], ancestors: [] as { id: string; name: string }[], libraryOnline: true },
    fetchData,
    "加载文件列表失败",
  );

  // 等待后端任务完成后再刷新列表，避免用户手动点“刷新”
  const waitTaskAndReload = useCallback(
    async (taskId: number) => {
      const maxWaitMs = 15000; // 最多等待 15 秒
      const intervalMs = 800; // 轮询间隔
      const start = Date.now();

      try {
        // 简单轮询任务状态直到成功 / 失败或超时
        // 即使超时，也会在最后调用一次 load 保证状态尽量同步
        while (Date.now() - start < maxWaitMs) {
          try {
            const { task } = await getTask(taskId);
            if (task.status === "SUCCESS" || task.status === "FAILED") {
              return;
            }
          } catch (err) {
            console.error("轮询任务状态失败", err);
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      } finally {
        // 超时或轮询失败时，兜底再刷新一次
        await load();
      }
    },
    [load],
  );

  const wrapTask = useCallback(
    async <T extends FileTaskResponse | null>(fn: () => Promise<T>): Promise<T> => {
      const result = await fn();

      // 若返回了任务 ID，则等待任务完成后再刷新；否则直接刷新
      const taskId = (result as FileTaskResponse | null)?.task?.id;
      if (typeof taskId === "number") {
        await waitTaskAndReload(taskId);
      } else {
        await load();
      }

      return result;

    },
    [load, waitTaskAndReload],
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
      upload: (files, parentId, onProgress) => {
        if (!libraryId) {
          return Promise.reject(new Error("library not selected"));
        }
        return wrapTask(() => uploadFiles({ libraryId, parentId, files, onProgress })) as Promise<UploadResponse>;
      },
      createFolder: async (name, parentId) => {
        if (!libraryId) {
          return Promise.reject(new Error("library not selected"));
        }
        const result = await apiCreateFolder({ libraryId, parentId, name });
        // 创建成功后刷新列表
        await load();
        return result;
      },
      indexLibrary: (options?: { forceReindex?: boolean }) =>
        libraryId ? wrapTask(() => apiIndexLibrary(libraryId, options)) : Promise.resolve(null),
      indexPath: (relativePath: string) =>
        libraryId
          ? wrapTask(() => apiIndexLibraryPath(libraryId, relativePath))
          : Promise.resolve(null),
    }),
    [wrapTask, libraryId, load],
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
