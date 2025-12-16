/**
 * 流式消息处理服务
 * 
 * 替代原有的 appendUserMessageAndReply，通过事件发射器推送各阶段状态
 */

import type { StreamEventEmitter, StreamMessageInput } from "./types.ts";
import { createEventFactory } from "./emitter.ts";
import { createLogger } from "../../../core/logger/index.ts";
import {
  getAiChatConversationById,
  getAiChatModelById,
  createAiChatMessage,
  listAiChatMessagesByConversation,
  getDefaultAiChatPrompt,
  callChatByModelId,
  tryAutoNameConversation,
} from "../service.ts";
import { buildVariableContext } from "../orchestrator.ts";
import {
  resolveEnabledToolKitKeys,
  getEnabledToolDefinitions,
  executeTool,
} from "../toolkits/registry.ts";
import type { ToolKitsConfig } from "../toolkits/types.ts";
import type { ChatMessageInput, ChatAttachment, ChatCallOptions } from "../../../core/ai/client.ts";
import { getConversationFilesByIds } from "../conversationFiles/repository.ts";
import { readFileAsBuffer } from "../conversationFiles/storage.ts";

const logger = createLogger("AI/StreamService");

// ============================================================================
// 辅助函数
// ============================================================================

/** 从上传 ID 列表构建图片附件 */
function buildImageAttachmentsFromUploadIds(uploadIds: number[]): ChatAttachment[] {
  const files = getConversationFilesByIds(uploadIds);
  const attachments: ChatAttachment[] = [];

  for (const file of files) {
    if (!file.mime_type?.startsWith("image/")) continue;

    try {
      const buffer = readFileAsBuffer(file.relative_path);
      if (buffer) {
        attachments.push({
          kind: "image",
          mimeType: file.mime_type,
          dataBase64: buffer.toString("base64"),
        });
      }
    } catch {
      // 忽略读取失败的文件
    }
  }

  return attachments;
}

// ============================================================================
// 流式消息处理
// ============================================================================

/**
 * 流式处理用户消息并生成回复
 * 
 * 通过 emitter 推送事件：received → thinking → delta/tool_start/tool_end → final
 */
export async function streamMessageAndReply(
  input: StreamMessageInput,
  emitter: StreamEventEmitter,
): Promise<void> {
  const startTime = Date.now();
  const events = createEventFactory(input.requestId, input.conversationId);

  logger.info(
    `[ai_stream] service_start requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId}`,
  );

  try {
    // ========================================================================
    // 阶段 1：接收并校验
    // ========================================================================
    const conv = getAiChatConversationById(input.conversationId);
    if (!conv) {
      logger.warn(
        `[ai_stream] conv_not_found requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId}`,
      );
      emitter.emit(events.error("会话不存在", "receive", false));
      emitter.close();
      return;
    }

    if (conv.user_id !== input.userId) {
      logger.warn(
        `[ai_stream] conv_forbidden requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId}`,
      );
      emitter.emit(events.error("无权操作该会话", "receive", false));
      emitter.close();
      return;
    }

    if (conv.is_archived) {
      logger.warn(
        `[ai_stream] conv_archived requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId}`,
      );
      emitter.emit(events.error("会话已归档，无法继续对话", "receive", false));
      emitter.close();
      return;
    }

    const model = getAiChatModelById(conv.model_id);
    if (!model || !model.is_enabled) {
      logger.warn(
        `[ai_stream] model_invalid requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} modelId=${conv.model_id}`,
      );
      emitter.emit(events.error("会话绑定的模型不存在或未启用", "receive", false));
      emitter.close();
      return;
    }

    // 写入用户消息
    const userMessage = createAiChatMessage({
      conversationId: conv.id,
      role: "user",
      content: input.content,
      payload: input.attachmentIds && input.attachmentIds.length > 0
        ? { attachmentIds: input.attachmentIds }
        : undefined,
    });

    // 发送 received 事件
    emitter.emit(events.received(userMessage.id, input.content));

    logger.info(
      `[ai_stream] received requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} userMessageId=${userMessage.id}`,
    );

    // 检查是否已取消
    if (input.signal?.aborted || emitter.isClosed()) {
      return;
    }

    // ========================================================================
    // 阶段 2：准备上下文
    // ========================================================================
    const maxContext = conv.max_context_messages ?? model.default_max_context_messages ?? 20;
    const history = listAiChatMessagesByConversation(conv.id, {
      limit: Math.max(maxContext * 2, maxContext),
      offset: 0,
    });
    const effectiveHistory = history.slice(-maxContext);
    const varContext = buildVariableContext(conv, null);

    // 构建附件
    let userMessageAttachments: ChatAttachment[] | undefined;
    if (input.attachmentIds && input.attachmentIds.length > 0) {
      const attachments = buildImageAttachmentsFromUploadIds(input.attachmentIds);
      if (attachments.length > 0) {
        userMessageAttachments = attachments;
      }
    }
    if (!userMessageAttachments) {
      const framesVar = varContext.conversationVars["videoFrames"];
      if (framesVar && framesVar.kind === "image_upload_list" && Array.isArray(framesVar.value)) {
        const attachments = buildImageAttachmentsFromUploadIds(framesVar.value as number[]);
        if (attachments.length > 0) {
          userMessageAttachments = attachments;
        }
      }
    }

    // 构建消息列表
    const messagesForAi: ChatMessageInput[] = [];

    // 系统提示词
    let systemPrompt = conv.system_prompt;
    if (!systemPrompt) {
      const defaultPrompt = getDefaultAiChatPrompt();
      if (defaultPrompt && defaultPrompt.content && defaultPrompt.content.trim().length > 0) {
        systemPrompt = defaultPrompt.content;
      }
    }
    if (systemPrompt && systemPrompt.trim().length > 0) {
      messagesForAi.push({ role: "system", content: systemPrompt });
    }

    // 系统级约束
    messagesForAi.push({
      role: "system",
      content:
        "重要：你只能输出本系统可验证的信息，禁止编造任何外部链接或预览/下载 URL（例如 content.googleapis.com 等）。当你通过工具创建了文件（如 Markdown/HTML）后，不要在正文中提供任何链接或重复整篇文件内容；只需简短说明文件已创建，并提示用户在工具卡片中预览/下载。",
    });

    // 历史消息
    effectiveHistory.forEach((msg) => {
      if (!msg.content) return;

      let role: "system" | "user" | "assistant";
      if (msg.role === "assistant") {
        role = "assistant";
      } else if (msg.role === "system") {
        role = "system";
      } else {
        role = "user";
      }

      const attachments =
        msg.id === userMessage.id && userMessageAttachments
          ? userMessageAttachments
          : undefined;

      messagesForAi.push({ role, content: msg.content, attachments });
    });

    // 工具配置
    const toolkitsConfig = conv.metadata?.toolkitsConfig as ToolKitsConfig | undefined;
    const enabledToolKitKeys = resolveEnabledToolKitKeys(toolkitsConfig, "user");
    const toolDefinitions = getEnabledToolDefinitions(toolkitsConfig, "user");

    // ========================================================================
    // 阶段 3：工具循环
    // ========================================================================
    const MAX_TOOL_ROUNDS = 5;
    let currentMessages = [...messagesForAi];
    let finalContent = "";
    let toolRound = 0;
    const createdFileNames: string[] = [];
    const collectedToolResults: Array<{
      toolName: string;
      args: Record<string, any>;
      result: any;
      pendingAction?: any;
      success: boolean;
      error?: string;
    }> = [];

    while (toolRound < MAX_TOOL_ROUNDS) {
      // 检查是否已取消
      if (input.signal?.aborted || emitter.isClosed()) {
        logger.warn(
          `[ai_stream] cancelled_before_model requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound + 1} aborted=${!!input.signal?.aborted} closed=${emitter.isClosed()}`,
        );
        return;
      }

      // 发送 thinking 事件
      emitter.emit(events.thinking(toolRound + 1, model.key, enabledToolKitKeys));

      logger.info(
        `[ai_stream] thinking requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound + 1} modelKey=${model.key}`,
      );

      // 避免同一轮次的同一工具重复发送 tool_start（流式工具调用可能多次出现）
      const emittedToolStarts = new Set<string>();

      // 构建调用选项
      const callOptions: ChatCallOptions = {
        stream: true,
        signal: input.signal,
        onDelta: (delta: string) => {
          if (!emitter.isClosed()) {
            emitter.emit(events.delta(delta, toolRound + 1));
          }
        },
        onToolCall: (toolName: string, toolIndex: number) => {
          if (emitter.isClosed()) return;
          const key = `${toolRound + 1}:${toolIndex}:${toolName}`;
          if (emittedToolStarts.has(key)) return;
          emittedToolStarts.add(key);
          emitter.emit(events.toolStart(toolName, {}, toolRound + 1, toolIndex));
        },
      };

      if (toolDefinitions.length > 0) {
        callOptions.tools = toolDefinitions;
        callOptions.tool_choice = "auto";
      }

      // 调用模型
      logger.info(
        `[ai_stream] call_model requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound + 1} tools=${toolDefinitions.length}`,
      );
      const aiResult = await callChatByModelId(conv.model_id, currentMessages, callOptions);

      logger.info(
        `[ai_stream] model_done requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound + 1} finishReason=${aiResult.finish_reason ?? ""} toolCalls=${aiResult.tool_calls?.length ?? 0} contentLen=${aiResult.content?.length ?? 0}`,
      );

      // 如果没有工具调用，直接结束
      if (!aiResult.tool_calls || aiResult.tool_calls.length === 0) {
        finalContent = aiResult.content;
        break;
      }

      // 有工具调用，执行工具
      toolRound++;

      // 添加 assistant 的工具调用消息
      currentMessages.push({
        role: "assistant",
        content: aiResult.content || null,
        tool_calls: aiResult.tool_calls,
      });

      // 执行每个工具
      for (let toolIndex = 0; toolIndex < aiResult.tool_calls.length; toolIndex++) {
        const toolCall = aiResult.tool_calls[toolIndex]!;
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, any> = {};

        const rawArgs = toolCall.function.arguments;

        try {
          toolArgs = JSON.parse(rawArgs);
        } catch (err: any) {
          // 兼容：部分模型/网关会返回包含真实换行符的 JSON 字符串，导致 JSON.parse 报 Unterminated string
          const normalizedRawArgs =
            typeof rawArgs === "string"
              ? rawArgs.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t")
              : rawArgs;

          try {
            toolArgs = JSON.parse(normalizedRawArgs as any);
            logger.info(
              `[ai_stream] tool_args_parse_recovered requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound} toolIndex=${toolIndex} toolName=${toolName}`,
            );
          } catch (err2: any) {
            toolArgs = {};
            logger.warn(
              `[ai_stream] tool_args_parse_failed requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound} toolIndex=${toolIndex} toolName=${toolName} rawArgsLen=${typeof rawArgs === "string" ? rawArgs.length : 0} rawArgsPreview=${typeof rawArgs === "string" ? JSON.stringify(rawArgs.slice(0, 200)) : "\"\""} error=${err?.message || ""}`,
            );
            logger.warn(
              `[ai_stream] tool_args_parse_failed_normalized requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound} toolIndex=${toolIndex} toolName=${toolName} normalizedArgsLen=${typeof normalizedRawArgs === "string" ? normalizedRawArgs.length : 0} error=${err2?.message || ""}`,
            );
          }
        }

        // 发送 tool_start 事件
        emitter.emit(events.toolStart(toolName, toolArgs, toolRound, toolIndex));

        logger.info(
          `[ai_stream] tool_start requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound} toolIndex=${toolIndex} toolName=${toolName}`,
        );

        const toolStartTime = Date.now();

        // 执行工具
        const toolResult = await executeTool(
          toolName,
          toolArgs,
          {
            userId: input.userId,
            conversationId: conv.id,
            conversationVars: varContext.conversationVars,
          },
          enabledToolKitKeys,
        );

        const toolDurationMs = Date.now() - toolStartTime;

        if (!toolResult.success) {
          logger.warn(
            `[ai_stream] tool_failed requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound} toolIndex=${toolIndex} toolName=${toolName} durationMs=${toolDurationMs} error=${toolResult.error || ""}`,
          );
        }

        // 发送 tool_end 事件
        emitter.emit(events.toolEnd(
          toolName,
          toolResult.success,
          toolRound,
          toolIndex,
          toolDurationMs,
          toolResult.error,
          toolResult.result?.type,
        ));

        logger.info(
          `[ai_stream] tool_end requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} round=${toolRound} toolIndex=${toolIndex} toolName=${toolName} success=${toolResult.success} durationMs=${toolDurationMs}`,
        );

        // 收集文件名
        if (
          toolResult.success &&
          (toolName === "create_markdown_file" ||
            toolName === "create_html_file" ||
            toolResult.result?.type === "markdown_file" ||
            toolResult.result?.type === "html_file")
        ) {
          const fn = toolResult.result?.filename;
          if (typeof fn === "string" && fn.trim().length > 0) {
            createdFileNames.push(fn.trim());
          }
        }

        // 累积工具调用结果
        collectedToolResults.push({
          toolName,
          args: toolArgs,
          result: toolResult.result,
          pendingAction: toolResult.pendingAction,
          success: toolResult.success,
          error: toolResult.error,
        });

        // 添加工具结果消息给模型
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.success ? toolResult.result : { error: toolResult.error }),
        });

        // 更新会话变量
        if (toolResult.updatedVars) {
          Object.assign(varContext.conversationVars, toolResult.updatedVars);
        }
      }
    }

    // 如果工具调用超过最大轮数，进行最后一次调用（不带工具）
    if (toolRound >= MAX_TOOL_ROUNDS && !finalContent) {
      emitter.emit(events.thinking(toolRound + 1, model.key, enabledToolKitKeys));

      const finalResult = await callChatByModelId(conv.model_id, currentMessages, {
        stream: true,
        signal: input.signal,
        onDelta: (delta: string) => {
          if (!emitter.isClosed()) {
            emitter.emit(events.delta(delta, toolRound + 1));
          }
        },
      });
      finalContent = finalResult.content;
    }

    // 文件生成时：如果模型没有返回文本内容，则生成默认提示
    // 如果模型已返回内容，则保留原内容（前端已通过 delta 事件收到）
    if (createdFileNames.length > 0 && !finalContent) {
      const uniqueNames = Array.from(new Set(createdFileNames));
      const namesText = uniqueNames.join("、");
      finalContent = `已生成文件：${namesText}。请在文件卡片中预览或下载。`;
    }

    // ========================================================================
    // 阶段 4：保存并发送最终结果
    // ========================================================================
    const assistantMessage = createAiChatMessage({
      conversationId: conv.id,
      role: "assistant",
      content: finalContent,
      toolName: null,
      payload: {
        provider: "chat_model",
        modelKey: model.key,
        toolRounds: toolRound > 0 ? toolRound : undefined,
        toolResults: collectedToolResults.length > 0 ? collectedToolResults : undefined,
      },
    });

    const totalDurationMs = Date.now() - startTime;

    logger.info(
      `[ai_stream] final_saved requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} assistantMessageId=${assistantMessage.id} totalRounds=${toolRound} totalDurationMs=${totalDurationMs} contentLen=${finalContent.length}`,
    );

    // 发送 final 事件
    emitter.emit(events.final(
      assistantMessage.id,
      finalContent,
      collectedToolResults,
      toolRound,
      totalDurationMs,
    ));

    // 自动会话命名（异步，不阻塞）
    tryAutoNameConversation(conv.id).catch(() => {});

  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "处理消息时发生错误";
    logger.error(
      `[ai_stream] service_error requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId} message=${message}`,
    );
    emitter.emit(events.error(message, "unknown", true));
  } finally {
    logger.info(
      `[ai_stream] service_close requestId=${input.requestId} conversationId=${input.conversationId} userId=${input.userId}`,
    );
    emitter.close();
  }
}
