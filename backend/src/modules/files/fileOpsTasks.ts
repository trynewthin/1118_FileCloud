/**
 * 文件操作任务处理器
 */
import type { TaskContext } from "../../core/tasks/types.ts";
import {
  moveEntryToTrash,
  restoreEntryFromTrash,
  permanentlyDeleteEntry,
  renameEntry,
  moveEntry,
  copyEntry,
} from "./fileOps.ts";
import { deleteTranscodeForEntry } from "../fileContent/transcodeService.ts";

// 任务类型常量
export const TASK_TYPE_FILE_DELETE_ENTRY = "FILE_DELETE_ENTRY";
export const TASK_TYPE_FILE_RESTORE_ENTRY = "FILE_RESTORE_ENTRY";
export const TASK_TYPE_FILE_DESTROY_ENTRY = "FILE_DESTROY_ENTRY";
export const TASK_TYPE_FILE_RENAME_ENTRY = "FILE_RENAME_ENTRY";
export const TASK_TYPE_FILE_MOVE_ENTRY = "FILE_MOVE_ENTRY";
export const TASK_TYPE_FILE_COPY_ENTRY = "FILE_COPY_ENTRY";

export const handleDeleteEntryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("删除任务缺少合法的文件索引 ID");
  }

  log.info(`删除文件: ${entryId}`);
  moveEntryToTrash(entryId);
};

export const handleRestoreEntryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("还原任务缺少合法的文件索引 ID");
  }

  log.info(`还原文件: ${entryId}`);
  restoreEntryFromTrash(entryId);
};

export const handleDestroyEntryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("彻底删除任务缺少合法的文件索引 ID");
  }

  log.info(`彻底删除文件: ${entryId}`);
  
  // 先删除转码文件
  deleteTranscodeForEntry(entryId);
  permanentlyDeleteEntry(entryId);
};

export const handleRenameEntryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as { entryId?: string; newName?: string };
  const { entryId, newName } = payload;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("重命名任务缺少合法的文件索引 ID");
  }

  if (!newName || typeof newName !== "string") {
    throw new Error("重命名任务缺少新名称");
  }

  log.info(`重命名文件: ${entryId} -> ${newName}`);
  renameEntry(entryId, newName);
};

export const handleMoveEntryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as { entryId?: string; targetParentId?: string | null };
  const { entryId, targetParentId } = payload;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("移动任务缺少合法的文件索引 ID");
  }

  log.info(`移动文件: ${entryId} -> ${targetParentId ?? "根目录"}`);
  moveEntry(entryId, targetParentId ?? null);
};

export const handleCopyEntryTask = async (ctx: TaskContext): Promise<void> => {
  const { task, log } = ctx;
  const payload = task.payload as {
    entryId?: string;
    targetParentId?: string | null;
    newName?: string;
  };
  const { entryId, targetParentId, newName } = payload;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("复制任务缺少合法的文件索引 ID");
  }

  log.info(`复制文件: ${entryId} -> ${targetParentId ?? "根目录"}`);
  copyEntry(entryId, targetParentId ?? null, newName);
};
