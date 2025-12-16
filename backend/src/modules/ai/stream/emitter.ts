/**
 * SSE 事件发射器
 * 
 * 封装 Express Response 为流式事件发射器
 */

import type { Response } from "express";
import type { StreamEvent, StreamEventEmitter } from "./types.ts";

/**
 * 创建 SSE 事件发射器
 */
export function createStreamEmitter(
  res: Response,
  requestId: string,
  conversationId: number,
): StreamEventEmitter {
  let sequence = 0;
  let closed = false;

  // 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // 禁用 nginx 缓冲
  res.flushHeaders();

  // 监听客户端断开
  res.on("close", () => {
    closed = true;
  });

  return {
    emit(event: StreamEvent): void {
      if (closed) return;

      // 自动填充公共字段
      const fullEvent = {
        ...event,
        requestId,
        conversationId,
        sequence: ++sequence,
        timestamp: Date.now(),
      };

      // SSE 格式：event: <type>\ndata: <json>\n\n
      const eventLine = `event: ${event.event}\n`;
      const dataLine = `data: ${JSON.stringify(fullEvent)}\n\n`;

      try {
        res.write(eventLine);
        res.write(dataLine);
        // 强制刷新（Bun/Node 兼容）
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }
      } catch {
        closed = true;
      }
    },

    close(): void {
      if (closed) return;
      closed = true;

      try {
        // 发送结束标记
        res.write("event: done\ndata: {}\n\n");
        res.end();
      } catch {
        // 忽略关闭时的错误
      }
    },

    isClosed(): boolean {
      return closed;
    },
  };
}

/**
 * 创建事件工厂函数（简化事件创建）
 */
export function createEventFactory(requestId: string, conversationId: number) {
  return {
    received(userMessageId: number, userContent: string) {
      return {
        event: "received" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { userMessageId, userContent },
      };
    },

    thinking(round: number, modelKey: string, enabledToolkits: string[]) {
      return {
        event: "thinking" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { round, modelKey, enabledToolkits },
      };
    },

    delta(content: string, round: number) {
      return {
        event: "delta" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { content, round },
      };
    },

    toolStart(toolName: string, args: Record<string, any>, round: number, toolIndex: number) {
      return {
        event: "tool_start" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { toolName, args, round, toolIndex },
      };
    },

    toolEnd(
      toolName: string,
      success: boolean,
      round: number,
      toolIndex: number,
      durationMs: number,
      error?: string,
      resultType?: string,
    ) {
      return {
        event: "tool_end" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { toolName, success, error, resultType, round, toolIndex, durationMs },
      };
    },

    final(
      assistantMessageId: number,
      content: string,
      toolResults: any[],
      totalRounds: number,
      totalDurationMs: number,
    ) {
      return {
        event: "final" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { assistantMessageId, content, toolResults, totalRounds, totalDurationMs },
      };
    },

    error(
      message: string,
      stage: "receive" | "thinking" | "tool" | "final" | "unknown",
      retryable: boolean,
      debugId?: string,
    ) {
      return {
        event: "error" as const,
        requestId,
        conversationId,
        sequence: 0,
        timestamp: Date.now(),
        data: { message, stage, retryable, debugId },
      };
    },
  };
}
