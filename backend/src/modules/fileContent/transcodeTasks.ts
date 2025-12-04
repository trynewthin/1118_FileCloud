/**
 * 视频转码任务处理器
 */
import type { TaskContext } from "../../core/tasks/types.ts";
import {
  executeTranscode,
  updateTranscodeProgress,
  markTranscodeCompleted,
  markTranscodeFailed,
} from "./transcodeService.ts";
import { getEntryById } from "../files/service.ts";

// 任务类型常量
export const TASK_TYPE_VIDEO_TRANSCODE = "VIDEO_TRANSCODE";

// 任务载荷类型
interface TranscodePayload {
  entryId: string;
  libraryId: number;
}

// 任务处理器
export const handleVideoTranscode = async (ctx: TaskContext): Promise<void> => {
  const { task, updateProgress, updateDetailProgress, log } = ctx;
  const payload = task.payload as TranscodePayload;
  const { entryId } = payload;

  // 验证文件存在
  const entry = getEntryById(entryId);
  if (!entry) {
    markTranscodeFailed(entryId, "文件不存在或已删除");
    throw new Error("文件不存在或已删除");
  }

  log.info(`开始转码: ${entry.original_name}`);
  updateDetailProgress(0, 100, "转码中");

  try {
    // 执行转码
    const result = await executeTranscode(entryId, (progress) => {
      // 检查是否被取消
      if (ctx.isCancelled()) {
        throw new Error("用户取消");
      }
      // 更新进度
      updateTranscodeProgress(entryId, progress);
      updateProgress(progress, "转码中");
      updateDetailProgress(progress, 100, "转码中");
    });

    if (result.success && result.outputPath && result.outputSize !== undefined) {
      // 转码成功
      markTranscodeCompleted(entryId, result.outputPath, result.outputSize);
      log.info(`转码完成: ${entry.original_name}`);
    } else {
      // 转码失败
      const errorMsg = result.error || "转码失败";
      markTranscodeFailed(entryId, errorMsg);
      throw new Error(errorMsg);
    }
  } catch (err: any) {
    const errorMsg = err.message || "转码过程发生异常";
    markTranscodeFailed(entryId, errorMsg);
    throw err;
  }
};
