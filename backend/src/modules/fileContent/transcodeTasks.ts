import { registerTaskHandler } from "../../core/tasks/executor.ts";
import type { TaskRecord } from "../tasks/service.ts";
import { updateTaskStatus, updateTaskDetailProgress } from "../tasks/service.ts";
import {
  executeTranscode,
  updateTranscodeProgress,
  markTranscodeCompleted,
  markTranscodeFailed,
} from "./transcodeService.ts";
import { getEntryById } from "../files/service.ts";

// ============================================================================
// 任务类型常量
// ============================================================================

export const TASK_TYPE_VIDEO_TRANSCODE = "VIDEO_TRANSCODE";

// ============================================================================
// 任务载荷类型
// ============================================================================

interface TranscodePayload {
  entryId: string;
  libraryId: number;
}

// ============================================================================
// 任务处理器
// ============================================================================

export const handleVideoTranscode = async (task: TaskRecord): Promise<void> => {
  const payload = task.payload as TranscodePayload;
  const { entryId } = payload;

  // 验证文件存在
  const entry = getEntryById(entryId);
  if (!entry) {
    updateTaskStatus({ id: task.id, status: "FAILED", errorMessage: "文件不存在或已删除", markFinished: true });
    markTranscodeFailed(entryId, "文件不存在或已删除");
    return;
  }

  // 更新任务状态为运行中
  updateTaskStatus({ id: task.id, status: "RUNNING", markStarted: true });
  updateTaskDetailProgress(task.id, { current: 0, total: 100, label: "转码中" });

  try {
    // 执行转码
    const result = await executeTranscode(entryId, (progress) => {
      // 更新进度
      updateTranscodeProgress(entryId, progress);
      updateTaskDetailProgress(task.id, { current: progress, total: 100, label: "转码中" });
    });

    if (result.success && result.outputPath && result.outputSize !== undefined) {
      // 转码成功
      markTranscodeCompleted(entryId, result.outputPath, result.outputSize);
      updateTaskStatus({ id: task.id, status: "SUCCESS", progress: 100, markFinished: true });
    } else {
      // 转码失败
      const errorMsg = result.error || "转码失败";
      markTranscodeFailed(entryId, errorMsg);
      updateTaskStatus({ id: task.id, status: "FAILED", errorMessage: errorMsg, markFinished: true });
    }
  } catch (err: any) {
    const errorMsg = err.message || "转码过程发生异常";
    markTranscodeFailed(entryId, errorMsg);
    updateTaskStatus({ id: task.id, status: "FAILED", errorMessage: errorMsg, markFinished: true });
  }
};

// ============================================================================
// 注册任务处理器
// ============================================================================

export const registerTranscodeTaskHandlers = (): void => {
  registerTaskHandler(TASK_TYPE_VIDEO_TRANSCODE, handleVideoTranscode);
};
