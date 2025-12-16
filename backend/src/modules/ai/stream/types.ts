/**
 * AI 对话流式事件协议类型定义
 * 
 * 事件流程：
 * 1. received - 后端已接收请求，用户消息已落库
 * 2. thinking - 开始调用模型（可能多轮工具循环）
 * 3. delta - 增量文本片段（仅当模型支持流式时）
 * 4. tool_start - 开始执行工具
 * 5. tool_end - 工具执行完成
 * 6. final - 最终结果，assistant 消息已落库
 * 7. error - 错误
 */

// ============================================================================
// 基础事件结构
// ============================================================================

/** 事件基础字段 */
export interface StreamEventBase {
  /** 事件类型 */
  event: string;
  /** 请求唯一标识（前端生成，用于关联） */
  requestId: string;
  /** 会话 ID */
  conversationId: number;
  /** 事件序号（递增，用于排序/去重） */
  sequence: number;
  /** 时间戳 */
  timestamp: number;
}

// ============================================================================
// 具体事件类型
// ============================================================================

/** received - 后端已接收请求 */
export interface ReceivedEvent extends StreamEventBase {
  event: "received";
  data: {
    /** 用户消息 ID（已落库） */
    userMessageId: number;
    /** 用户消息内容 */
    userContent: string;
  };
}

/** thinking - 开始调用模型 */
export interface ThinkingEvent extends StreamEventBase {
  event: "thinking";
  data: {
    /** 当前工具循环轮次（从 1 开始） */
    round: number;
    /** 使用的模型 key */
    modelKey: string;
    /** 启用的工具包 */
    enabledToolkits: string[];
  };
}

/** delta - 增量文本片段 */
export interface DeltaEvent extends StreamEventBase {
  event: "delta";
  data: {
    /** 增量文本内容 */
    content: string;
    /** 当前工具循环轮次 */
    round: number;
  };
}

/** tool_start - 开始执行工具 */
export interface ToolStartEvent extends StreamEventBase {
  event: "tool_start";
  data: {
    /** 工具名称 */
    toolName: string;
    /** 工具参数（可能脱敏/摘要） */
    args: Record<string, any>;
    /** 当前工具循环轮次 */
    round: number;
    /** 本轮第几个工具调用 */
    toolIndex: number;
  };
}

/** tool_end - 工具执行完成 */
export interface ToolEndEvent extends StreamEventBase {
  event: "tool_end";
  data: {
    /** 工具名称 */
    toolName: string;
    /** 是否成功 */
    success: boolean;
    /** 错误信息（失败时） */
    error?: string;
    /** 结果类型（用于前端预判渲染） */
    resultType?: string;
    /** 当前工具循环轮次 */
    round: number;
    /** 本轮第几个工具调用 */
    toolIndex: number;
    /** 耗时（毫秒） */
    durationMs: number;
  };
}

/** final - 最终结果 */
export interface FinalEvent extends StreamEventBase {
  event: "final";
  data: {
    /** assistant 消息 ID（已落库） */
    assistantMessageId: number;
    /** assistant 消息内容 */
    content: string;
    /** 工具调用结果列表 */
    toolResults: Array<{
      toolName: string;
      args: Record<string, any>;
      result: any;
      pendingAction?: {
        toolName: string;
        description: string;
        args: Record<string, any>;
      };
      success: boolean;
      error?: string;
    }>;
    /** 总工具循环轮次 */
    totalRounds: number;
    /** 总耗时（毫秒） */
    totalDurationMs: number;
  };
}

/** error - 错误 */
export interface ErrorEvent extends StreamEventBase {
  event: "error";
  data: {
    /** 用户可读错误信息 */
    message: string;
    /** 错误发生阶段 */
    stage: "receive" | "thinking" | "tool" | "final" | "unknown";
    /** 调试 ID（可选，用于日志追踪） */
    debugId?: string;
    /** 是否可重试 */
    retryable: boolean;
  };
}

/** 所有事件类型联合 */
export type StreamEvent =
  | ReceivedEvent
  | ThinkingEvent
  | DeltaEvent
  | ToolStartEvent
  | ToolEndEvent
  | FinalEvent
  | ErrorEvent;

// ============================================================================
// 辅助类型
// ============================================================================

/** 事件发射器接口 */
export interface StreamEventEmitter {
  /** 发送事件 */
  emit(event: StreamEvent): void;
  /** 关闭流 */
  close(): void;
  /** 是否已关闭 */
  isClosed(): boolean;
}

/** 流式请求输入 */
export interface StreamMessageInput {
  /** 会话 ID */
  conversationId: number;
  /** 用户 ID */
  userId: number;
  /** 消息内容 */
  content: string;
  /** 附件 ID 列表 */
  attachmentIds?: number[];
  /** 请求 ID（前端生成） */
  requestId: string;
  /** AbortSignal（用于取消） */
  signal?: AbortSignal;
}
