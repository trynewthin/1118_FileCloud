/**
 * Files 模块定义
 * 
 * 包含：
 * - 文件浏览、操作相关路由
 * - 文件索引任务处理器
 * - 文件操作任务处理器
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { filesRouter } from "./router.ts";
import {
  TASK_TYPE_FILE_INDEX_LIBRARY,
  TASK_TYPE_FILE_INDEX_SINGLE,
  handleIndexLibraryTask,
  handleIndexSingleTask,
} from "./indexTasks.ts";
import {
  TASK_TYPE_FILE_DELETE_ENTRY,
  TASK_TYPE_FILE_RESTORE_ENTRY,
  TASK_TYPE_FILE_DESTROY_ENTRY,
  TASK_TYPE_FILE_RENAME_ENTRY,
  TASK_TYPE_FILE_MOVE_ENTRY,
  TASK_TYPE_FILE_COPY_ENTRY,
  handleDeleteEntryTask,
  handleRestoreEntryTask,
  handleDestroyEntryTask,
  handleRenameEntryTask,
  handleMoveEntryTask,
  handleCopyEntryTask,
} from "./fileOpsTasks.ts";

export const filesModule: ModuleDefinition = {
  name: "Files",
  
  router: {
    prefix: "/api/files",
    instance: filesRouter,
  },
  
  taskHandlers: [
    // 索引任务
    { type: TASK_TYPE_FILE_INDEX_LIBRARY, handler: handleIndexLibraryTask },
    { type: TASK_TYPE_FILE_INDEX_SINGLE, handler: handleIndexSingleTask },
    // 文件操作任务
    { type: TASK_TYPE_FILE_DELETE_ENTRY, handler: handleDeleteEntryTask },
    { type: TASK_TYPE_FILE_RESTORE_ENTRY, handler: handleRestoreEntryTask },
    { type: TASK_TYPE_FILE_DESTROY_ENTRY, handler: handleDestroyEntryTask },
    { type: TASK_TYPE_FILE_RENAME_ENTRY, handler: handleRenameEntryTask },
    { type: TASK_TYPE_FILE_MOVE_ENTRY, handler: handleMoveEntryTask },
    { type: TASK_TYPE_FILE_COPY_ENTRY, handler: handleCopyEntryTask },
  ],
};
