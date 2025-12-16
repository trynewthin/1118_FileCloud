/**
 * AI 对话流式 API 客户端
 * 
 * 消费后端 SSE 事件流，支持 thinking/delta/final 等状态
 */

import { getAuthToken, buildApiUrl } from "./client";

// ============================================================================
// 事件类型定义（与后端保持一致）
// ============================================================================

/** 事件基础字段 */
export interface StreamEventBase {
  event: string;
  requestId: string;
  conversationId: number;
  sequence: number;
  timestamp: number;
}

/** received - 后端已接收请求 */
export interface ReceivedEvent extends StreamEventBase {
  event: "received";
  data: {
    userMessageId: number;
    userContent: string;
  };
}

/** thinking - 开始调用模型 */
export interface ThinkingEvent extends StreamEventBase {
  event: "thinking";
  data: {
    round: number;
    modelKey: string;
    enabledToolkits: string[];
  };
}

/** delta - 增量文本片段 */
export interface DeltaEvent extends StreamEventBase {
  event: "delta";
  data: {
    content: string;
    round: number;
  };
}

/** tool_start - 开始执行工具 */
export interface ToolStartEvent extends StreamEventBase {
  event: "tool_start";
  data: {
    toolName: string;
    args: Record<string, any>;
    round: number;
    toolIndex: number;
  };
}

/** tool_end - 工具执行完成 */
export interface ToolEndEvent extends StreamEventBase {
  event: "tool_end";
  data: {
    toolName: string;
    success: boolean;
    error?: string;
    resultType?: string;
    round: number;
    toolIndex: number;
    durationMs: number;
  };
}

/** final - 最终结果 */
export interface FinalEvent extends StreamEventBase {
  event: "final";
  data: {
    assistantMessageId: number;
    content: string;
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
    totalRounds: number;
    totalDurationMs: number;
  };
}

/** error - 错误 */
export interface ErrorEvent extends StreamEventBase {
  event: "error";
  data: {
    message: string;
    stage: "receive" | "thinking" | "tool" | "final" | "unknown";
    debugId?: string;
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
// 流式请求接口
// ============================================================================

export interface SendMessageStreamOptions {
  conversationId: number;
  content: string;
  attachmentIds?: number[];
  requestId?: string;
  signal?: AbortSignal;
  onReceived?: (event: ReceivedEvent) => void;
  onThinking?: (event: ThinkingEvent) => void;
  onDelta?: (event: DeltaEvent) => void;
  onToolStart?: (event: ToolStartEvent) => void;
  onToolEnd?: (event: ToolEndEvent) => void;
  onFinal?: (event: FinalEvent) => void;
  onError?: (event: ErrorEvent) => void;
}

/**
 * 发送消息并消费 SSE 流
 */
export async function sendMessageStream(options: SendMessageStreamOptions): Promise<void> {
  const {
    conversationId,
    content,
    attachmentIds,
    requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    signal,
    onReceived,
    onThinking,
    onDelta,
    onToolStart,
    onToolEnd,
    onFinal,
    onError,
  } = options;

  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const body = JSON.stringify({
    content,
    attachmentIds,
    requestId,
  });

  const response = await fetch(
    buildApiUrl(`/ai/conversations/${conversationId}/messages`),
    {
      method: "POST",
      headers,
      body,
      signal,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let message = "请求失败";
    try {
      const json = JSON.parse(text);
      if (typeof json.message === "string") {
        message = json.message;
      }
    } catch {
      // 忽略解析错误
    }
    throw new Error(message);
  }

  // 检查是否是 SSE 响应
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error("服务器未返回流式响应");
  }

  // 读取 SSE 流
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按双换行分割事件
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;

        // 解析事件
        const lines = part.split("\n");
        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);
          }
        }

        if (!eventType || !eventData) continue;

        // 解析 JSON 数据
        let parsed: StreamEvent;
        try {
          parsed = JSON.parse(eventData);
        } catch {
          continue;
        }

        // 分发事件
        switch (eventType) {
          case "received":
            onReceived?.(parsed as ReceivedEvent);
            break;
          case "thinking":
            onThinking?.(parsed as ThinkingEvent);
            break;
          case "delta":
            onDelta?.(parsed as DeltaEvent);
            break;
          case "tool_start":
            onToolStart?.(parsed as ToolStartEvent);
            break;
          case "tool_end":
            onToolEnd?.(parsed as ToolEndEvent);
            break;
          case "final":
            onFinal?.(parsed as FinalEvent);
            break;
          case "error":
            onError?.(parsed as ErrorEvent);
            break;
          case "done":
            // 流结束
            return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
