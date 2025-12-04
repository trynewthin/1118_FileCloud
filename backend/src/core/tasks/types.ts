/**
 * 任务系统类型定义
 * 
 * 设计原则：
 * 1. 任务类型采用 "领域.动作" 格式，如 "file.index", "thumbnail.generate"
 * 2. 进度统一使用 0-100 百分比，detail_progress 用于显示具体数值
 * 3. 子任务粒度：一个原子操作 = 一个子任务，父任务负责聚合
 * 4. 任务描述由系统根据类型和 payload 自动生成，不由调用方自定义
 */

// ============================================================================
// 任务状态
// ============================================================================

export type TaskStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

// ============================================================================
// 任务类型枚举（统一管理，避免魔法字符串）
// ============================================================================

export const TaskTypes = {
  // 文件索引
  FILE_INDEX_LIBRARY: "FILE_INDEX_LIBRARY",      // 全库索引
  FILE_INDEX_SINGLE: "FILE_INDEX_SINGLE",        // 单文件/目录索引
  
  // 文件操作
  FILE_DELETE: "FILE_DELETE_ENTRY",              // 删除（移入回收站）
  FILE_RESTORE: "FILE_RESTORE_ENTRY",            // 还原
  FILE_DESTROY: "FILE_DESTROY_ENTRY",            // 彻底删除
  FILE_RENAME: "FILE_RENAME_ENTRY",              // 重命名
  FILE_MOVE: "FILE_MOVE_ENTRY",                  // 移动
  FILE_COPY: "FILE_COPY_ENTRY",                  // 复制
  
  // 媒体处理
  MEDIA_THUMBNAIL: "FILE_GENERATE_THUMBNAIL",    // 生成缩略图
  MEDIA_TRANSCODE: "VIDEO_TRANSCODE",            // 视频转码
} as const;

export type TaskType = typeof TaskTypes[keyof typeof TaskTypes];

// ============================================================================
// 任务类别（用于并发控制和优先级）
// ============================================================================

export const TaskCategories = {
  // IO 密集型：文件读写、网络请求
  IO: "io",
  // CPU 密集型：转码、压缩
  CPU: "cpu",
  // 快速任务：通常 < 1秒完成
  QUICK: "quick",
} as const;

export type TaskCategory = typeof TaskCategories[keyof typeof TaskCategories];

// 任务类型到类别的映射（使用 Partial 以支持未知类型）
export const TaskTypeToCategory: Partial<Record<string, TaskCategory>> = {
  [TaskTypes.FILE_INDEX_LIBRARY]: TaskCategories.IO,
  [TaskTypes.FILE_INDEX_SINGLE]: TaskCategories.IO,
  [TaskTypes.FILE_DELETE]: TaskCategories.QUICK,
  [TaskTypes.FILE_RESTORE]: TaskCategories.QUICK,
  [TaskTypes.FILE_DESTROY]: TaskCategories.QUICK,
  [TaskTypes.FILE_RENAME]: TaskCategories.QUICK,
  [TaskTypes.FILE_MOVE]: TaskCategories.IO,
  [TaskTypes.FILE_COPY]: TaskCategories.IO,
  [TaskTypes.MEDIA_THUMBNAIL]: TaskCategories.CPU,
  [TaskTypes.MEDIA_TRANSCODE]: TaskCategories.CPU,
};

// ============================================================================
// 任务优先级
// ============================================================================

export const TaskPriorities = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
} as const;

export type TaskPriority = typeof TaskPriorities[keyof typeof TaskPriorities];

// 任务类型到默认优先级的映射
export const TaskTypeToDefaultPriority: Partial<Record<string, TaskPriority>> = {
  [TaskTypes.FILE_INDEX_LIBRARY]: TaskPriorities.LOW,
  [TaskTypes.FILE_INDEX_SINGLE]: TaskPriorities.NORMAL,
  [TaskTypes.FILE_DELETE]: TaskPriorities.NORMAL,
  [TaskTypes.FILE_RESTORE]: TaskPriorities.NORMAL,
  [TaskTypes.FILE_DESTROY]: TaskPriorities.NORMAL,
  [TaskTypes.FILE_RENAME]: TaskPriorities.HIGH,
  [TaskTypes.FILE_MOVE]: TaskPriorities.NORMAL,
  [TaskTypes.FILE_COPY]: TaskPriorities.NORMAL,
  [TaskTypes.MEDIA_THUMBNAIL]: TaskPriorities.LOW,
  [TaskTypes.MEDIA_TRANSCODE]: TaskPriorities.LOW,
};

// ============================================================================
// 详细进度（用于显示如 "1000/8889" 的进度）
// ============================================================================

export interface DetailProgress {
  current: number;
  total: number;
  // 当前阶段标签，如 "扫描文件", "生成缩略图"
  stage?: string;
  // 兼容旧版 label 字段
  label?: string;
}

// ============================================================================
// 任务描述生成器（根据类型和 payload 自动生成人类可读描述）
// ============================================================================

export interface TaskDescriptor {
  // 任务标题，如 "索引文件库"
  title: string;
  // 任务描述，如 "正在索引 '我的文档' 文件库"
  description: string;
  // 图标名称（可选，用于前端显示）
  icon?: string;
}

// Payload 类型定义
export interface IndexLibraryPayload {
  libraryId: number;
  libraryName?: string;
  forceReindex?: boolean;
}

export interface IndexSinglePayload {
  libraryId: number;
  relativePath: string;
}

export interface FileOperationPayload {
  entryId: string;
  entryName?: string;
}

export interface FileRenamePayload extends FileOperationPayload {
  newName: string;
}

export interface FileMovePayload extends FileOperationPayload {
  targetParentId: string | null;
  targetParentName?: string;
}

export interface FileCopyPayload extends FileMovePayload {
  newName?: string;
}

export interface ThumbnailPayload {
  entryId: string;
  entryName?: string;
}

export interface TranscodePayload {
  entryId: string;
  entryName?: string;
  libraryId: number;
}

// 所有 Payload 类型的联合
export type TaskPayload =
  | IndexLibraryPayload
  | IndexSinglePayload
  | FileOperationPayload
  | FileRenamePayload
  | FileMovePayload
  | FileCopyPayload
  | ThumbnailPayload
  | TranscodePayload;

// 任务描述生成函数（支持任意字符串类型）
export const generateTaskDescriptor = (type: string, payload: unknown): TaskDescriptor => {
  switch (type) {
    case TaskTypes.FILE_INDEX_LIBRARY: {
      const p = payload as IndexLibraryPayload;
      return {
        title: "索引文件库",
        description: p.libraryName 
          ? `正在索引文件库 "${p.libraryName}"${p.forceReindex ? "（强制重建）" : ""}`
          : `正在索引文件库 #${p.libraryId}`,
        icon: "folder-sync",
      };
    }
    case TaskTypes.FILE_INDEX_SINGLE: {
      const p = payload as IndexSinglePayload;
      return {
        title: "索引路径",
        description: `正在索引 ${p.relativePath}`,
        icon: "file-search",
      };
    }
    case TaskTypes.FILE_DELETE: {
      const p = payload as FileOperationPayload;
      return {
        title: "删除文件",
        description: p.entryName ? `正在删除 "${p.entryName}"` : "正在删除文件",
        icon: "trash",
      };
    }
    case TaskTypes.FILE_RESTORE: {
      const p = payload as FileOperationPayload;
      return {
        title: "还原文件",
        description: p.entryName ? `正在还原 "${p.entryName}"` : "正在还原文件",
        icon: "rotate-ccw",
      };
    }
    case TaskTypes.FILE_DESTROY: {
      const p = payload as FileOperationPayload;
      return {
        title: "彻底删除",
        description: p.entryName ? `正在彻底删除 "${p.entryName}"` : "正在彻底删除文件",
        icon: "trash-2",
      };
    }
    case TaskTypes.FILE_RENAME: {
      const p = payload as FileRenamePayload;
      return {
        title: "重命名",
        description: p.entryName 
          ? `正在将 "${p.entryName}" 重命名为 "${p.newName}"`
          : `正在重命名为 "${p.newName}"`,
        icon: "edit",
      };
    }
    case TaskTypes.FILE_MOVE: {
      const p = payload as FileMovePayload;
      return {
        title: "移动文件",
        description: p.entryName 
          ? `正在移动 "${p.entryName}"`
          : "正在移动文件",
        icon: "folder-input",
      };
    }
    case TaskTypes.FILE_COPY: {
      const p = payload as FileCopyPayload;
      return {
        title: "复制文件",
        description: p.entryName 
          ? `正在复制 "${p.entryName}"`
          : "正在复制文件",
        icon: "copy",
      };
    }
    case TaskTypes.MEDIA_THUMBNAIL: {
      const p = payload as ThumbnailPayload;
      return {
        title: "生成缩略图",
        description: p.entryName 
          ? `正在为 "${p.entryName}" 生成缩略图`
          : "正在生成缩略图",
        icon: "image",
      };
    }
    case TaskTypes.MEDIA_TRANSCODE: {
      const p = payload as TranscodePayload;
      return {
        title: "视频转码",
        description: p.entryName 
          ? `正在转码 "${p.entryName}"`
          : "正在转码视频",
        icon: "film",
      };
    }
    default:
      return {
        title: "未知任务",
        description: "正在执行任务",
        icon: "loader",
      };
  }
};

// ============================================================================
// 任务记录（数据库模型）
// ============================================================================

export interface TaskRecord {
  id: number;
  parent_task_id: number | null;
  type: TaskType;
  payload: TaskPayload;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;                    // 0-100 百分比
  detail_progress: DetailProgress | null;
  error_message: string | null;
  retry_count: number;                 // 已重试次数
  max_retries: number;                 // 最大重试次数
  created_by_user_id: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  // 运行时附加字段
  children?: TaskRecord[];
  descriptor?: TaskDescriptor;
}

// ============================================================================
// 任务处理器接口
// ============================================================================

export interface TaskContext {
  task: TaskRecord;
  // 更新进度（0-100）
  updateProgress: (progress: number, stage?: string) => void;
  // 更新详细进度
  updateDetailProgress: (current: number, total: number, stage?: string) => void;
  // 记录日志
  log: {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string, err?: unknown) => void;
  };
  // 检查是否被取消
  isCancelled: () => boolean;
  // 创建子任务
  createChildTask: (type: string, payload: unknown) => TaskRecord;
}

// 新版处理器（推荐）：使用 TaskContext
export type TaskHandlerNew = (ctx: TaskContext) => Promise<void>;

// 旧版处理器（兼容）：直接使用 TaskRecord
export type TaskHandlerLegacy = (task: TaskRecord) => Promise<void> | void;

// 统一处理器类型：支持新旧两种签名
export type TaskHandler = TaskHandlerNew | TaskHandlerLegacy;

// ============================================================================
// 任务执行器配置
// ============================================================================

export interface TaskExecutorConfig {
  // 轮询间隔（毫秒），仅作为兜底
  pollIntervalMs: number;
  // 各类别的并发数
  concurrency: {
    [TaskCategories.IO]: number;
    [TaskCategories.CPU]: number;
    [TaskCategories.QUICK]: number;
  };
  // 默认最大重试次数
  defaultMaxRetries: number;
  // 重试延迟（毫秒）
  retryDelayMs: number;
}

export const DEFAULT_EXECUTOR_CONFIG: TaskExecutorConfig = {
  pollIntervalMs: 5000,  // 5秒轮询作为兜底
  concurrency: {
    [TaskCategories.IO]: 2,     // 同时 2 个 IO 任务
    [TaskCategories.CPU]: 1,    // 同时 1 个 CPU 任务（转码很吃资源）
    [TaskCategories.QUICK]: 5,  // 同时 5 个快速任务
  },
  defaultMaxRetries: 3,
  retryDelayMs: 5000,
};
