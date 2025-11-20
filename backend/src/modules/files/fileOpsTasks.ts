import { registerTaskHandler } from "../../core/tasks/executor.ts";
import type { TaskRecord } from "../tasks/service.ts";
import { updateTaskStatus } from "../tasks/service.ts";
import {
  moveEntryToTrash,
  restoreEntryFromTrash,
  permanentlyDeleteEntry,
  renameEntry,
  moveEntry,
  copyEntry,
} from "./fileOps.ts";

export const TASK_TYPE_FILE_DELETE_ENTRY = "FILE_DELETE_ENTRY";
export const TASK_TYPE_FILE_RESTORE_ENTRY = "FILE_RESTORE_ENTRY";
export const TASK_TYPE_FILE_DESTROY_ENTRY = "FILE_DESTROY_ENTRY";
export const TASK_TYPE_FILE_RENAME_ENTRY = "FILE_RENAME_ENTRY";
export const TASK_TYPE_FILE_MOVE_ENTRY = "FILE_MOVE_ENTRY";
export const TASK_TYPE_FILE_COPY_ENTRY = "FILE_COPY_ENTRY";

const handleDeleteEntryTask = async (task: TaskRecord) => {
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("删除任务缺少合法的文件索引 ID");
  }

  moveEntryToTrash(entryId);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

const handleRestoreEntryTask = async (task: TaskRecord) => {
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("还原任务缺少合法的文件索引 ID");
  }

  restoreEntryFromTrash(entryId);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

const handleDestroyEntryTask = async (task: TaskRecord) => {
  const payload = task.payload as { entryId?: string };
  const entryId = payload.entryId;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("彻底删除任务缺少合法的文件索引 ID");
  }

  permanentlyDeleteEntry(entryId);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};
const handleRenameEntryTask = async (task: TaskRecord) => {
  const payload = task.payload as { entryId?: string; newName?: string };
  const { entryId, newName } = payload;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("重命名任务缺少合法的文件索引 ID");
  }

  if (!newName || typeof newName !== "string") {
    throw new Error("重命名任务缺少新名称");
  }

  renameEntry(entryId, newName);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

const handleMoveEntryTask = async (task: TaskRecord) => {
  const payload = task.payload as { entryId?: string; targetParentId?: string | null };
  const { entryId, targetParentId } = payload;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("移动任务缺少合法的文件索引 ID");
  }

  moveEntry(entryId, targetParentId ?? null);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

const handleCopyEntryTask = async (task: TaskRecord) => {
  const payload = task.payload as {
    entryId?: string;
    targetParentId?: string | null;
    newName?: string;
  };
  const { entryId, targetParentId, newName } = payload;

  if (!entryId || typeof entryId !== "string") {
    throw new Error("复制任务缺少合法的文件索引 ID");
  }

  copyEntry(entryId, targetParentId ?? null, newName);

  updateTaskStatus({ id: task.id, status: "RUNNING", progress: 90 });
};

export const registerFileOpsTaskHandlers = () => {
  registerTaskHandler(TASK_TYPE_FILE_DELETE_ENTRY, handleDeleteEntryTask);
  registerTaskHandler(TASK_TYPE_FILE_RESTORE_ENTRY, handleRestoreEntryTask);
  registerTaskHandler(TASK_TYPE_FILE_DESTROY_ENTRY, handleDestroyEntryTask);
  registerTaskHandler(TASK_TYPE_FILE_RENAME_ENTRY, handleRenameEntryTask);
  registerTaskHandler(TASK_TYPE_FILE_MOVE_ENTRY, handleMoveEntryTask);
  registerTaskHandler(TASK_TYPE_FILE_COPY_ENTRY, handleCopyEntryTask);
};
