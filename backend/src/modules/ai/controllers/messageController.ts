import type { Request, Response } from "express";
import { getAiChatConversationById } from "../service.ts";
import { createStreamEmitter, streamMessageAndReply } from "../stream/index.ts";
import {
  abortStreamRequest,
  registerStreamAbort,
  unregisterStreamAbort,
} from "../stream/abortRegistry.ts";
import { createLogger } from "../../../core/logger/index.ts";

const logger = createLogger("AI/MessageController");

/**
 * 消息处理控制器
 */

// 发送消息（流式接口）
// 返回 SSE 事件流：received → thinking → delta → tool_start → tool_end → final
export const sendMessage = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const userId = req.user.id;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "会话 ID 不合法" });
  }

  const { content, attachmentIds, requestId } = req.body as {
    content?: string;
    attachmentIds?: number[];
    requestId?: string;
  };

  // 如果有附件，内容可以为空
  const hasAttachments = attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0;
  if ((!content || !content.trim()) && !hasAttachments) {
    return res.status(400).json({ message: "消息内容不能为空" });
  }

  // 验证 attachmentIds 格式
  let validAttachmentIds: number[] | undefined;
  if (hasAttachments) {
    validAttachmentIds = attachmentIds.filter((aid) => Number.isInteger(aid) && aid > 0);
  }

  // 生成请求 ID（如果前端未提供）
  const finalRequestId =
    requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  logger.info(
    `[ai_stream] start requestId=${finalRequestId} conversationId=${id} userId=${userId} hasAttachments=${!!validAttachmentIds?.length}`,
  );

  // 创建 AbortController 用于取消请求
  const controller = new AbortController();

  // 注册到进程内终止表（用于前端通过 requestId 主动终止）
  registerStreamAbort({
    requestId: finalRequestId,
    conversationId: id,
    userId,
    controller,
  });

  let finished = false;
  res.on("finish", () => {
    finished = true;
    unregisterStreamAbort(finalRequestId);
    logger.info(
      `[ai_stream] finish requestId=${finalRequestId} conversationId=${id} userId=${userId}`,
    );
  });

  req.on("aborted", () => {
    logger.warn(
      `[ai_stream] req_aborted requestId=${finalRequestId} conversationId=${id} userId=${userId}`,
    );
    controller.abort();
    unregisterStreamAbort(finalRequestId);
  });

  res.on("close", () => {
    if (!finished) {
      logger.warn(
        `[ai_stream] res_close_before_finish requestId=${finalRequestId} conversationId=${id} userId=${userId}`,
      );
      controller.abort();
      unregisterStreamAbort(finalRequestId);
    }
  });

  // 创建 SSE 事件发射器
  const emitter = createStreamEmitter(res, finalRequestId, id);

  logger.debug(
    `[ai_stream] sse_headers_ready requestId=${finalRequestId} conversationId=${id} userId=${userId}`,
  );

  // 执行流式消息处理
  await streamMessageAndReply(
    {
      conversationId: id,
      userId,
      content: content?.trim() || "",
      attachmentIds: validAttachmentIds,
      requestId: finalRequestId,
      signal: controller.signal,
    },
    emitter,
  );
};

// 主动终止正在进行的流式消息（按 requestId）
export const abortMessage = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "未登录" });
  }

  const conversationId = Number(req.params.id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({ message: "会话 ID 不合法" });
  }

  const { requestId } = req.body as { requestId?: string };
  if (!requestId || typeof requestId !== "string" || requestId.trim().length === 0) {
    return res.status(400).json({ message: "requestId 不能为空" });
  }

  const userId = req.user.id;
  const rid = requestId.trim();

  const result = abortStreamRequest({ requestId: rid, conversationId, userId });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return res.status(404).json({ message: "未找到可终止的请求" });
    }
    if (result.reason === "forbidden") {
      return res.status(403).json({ message: "无权终止该请求" });
    }
    return res.status(400).json({ message: "终止失败" });
  }

  logger.info(
    `[ai_stream] abort_by_api requestId=${rid} conversationId=${conversationId} userId=${userId}`,
  );

  return res.json({ success: true });
};
