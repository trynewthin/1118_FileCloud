/**
 * FileContent 模块定义
 * 
 * 包含：
 * - 文件内容流式传输
 * - 缩略图生成和获取
 * - 视频转码
 */

import type { ModuleDefinition } from "../../core/module-loader/index.ts";
import { fileContentRouter } from "./router.ts";
import {
  TASK_TYPE_FILE_GENERATE_THUMBNAIL,
  handleGenerateThumbnailTask,
} from "./thumbnailTasks.ts";
import {
  TASK_TYPE_VIDEO_TRANSCODE,
  handleVideoTranscode,
} from "./transcodeTasks.ts";

export const fileContentModule: ModuleDefinition = {
  name: "FileContent",
  
  router: {
    prefix: "/api/file-content",
    instance: fileContentRouter,
  },
  
  taskHandlers: [
    { type: TASK_TYPE_FILE_GENERATE_THUMBNAIL, handler: handleGenerateThumbnailTask },
    { type: TASK_TYPE_VIDEO_TRANSCODE, handler: handleVideoTranscode },
  ],
};
