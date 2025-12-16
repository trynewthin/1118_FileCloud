import { useCallback, useEffect, useState, useRef } from "react";
import type {
  AiChatConversation,
  AiChatMessage,
  CreateAiConversationRequest,
  UpdateAiConversationRequest,
  ToolKitsConfig,
  ToolKitListItem,
} from "@/lib/api/aiChat";
import {
  listAiConversations,
  listAiMessages,
  createAiConversation,
  updateAiConversation,
  deleteAiConversation,
  uploadConversationFiles,
  abortAiChatMessageStream,
  executeAiTool,
  listToolKits,
} from "@/lib/api/aiChat";
import { sendMessageStream } from "@/lib/api/aiChatStream";
import type { LocalAttachment } from "@/lib/types/aiChat";

// 重新导出类型以保持向后兼容
export type { LocalAttachment } from "@/lib/types/aiChat";

/** 流式状态 */
export type StreamingStatus = "idle" | "thinking" | "streaming" | "tool";

interface AiChatState {
  conversations: AiChatConversation[];
  messages: AiChatMessage[];
  currentConversationId: number | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  toolkits: ToolKitListItem[];
  loadingToolkits: boolean;
  sending: boolean;
  /** 流式状态 */
  streamingStatus: StreamingStatus;
  /** 当前正在执行的工具名称 */
  currentToolName: string | null;
  error: string | null;
}

// 管理 AI 会话与消息的 hook，封装会话选择、创建和发送逻辑
export const useAiChat = () => {
  // 从 localStorage 读取上次选中的会话 ID
  const getSavedConversationId = (): number | null => {
    try {
      const saved = localStorage.getItem("ai_current_conversation_id");
      if (saved) {
        const id = parseInt(saved, 10);
        return isNaN(id) ? null : id;
      }
    } catch {
      // 忽略 localStorage 错误
    }
    return null;
  };

  const [state, setState] = useState<AiChatState>({
    conversations: [],
    messages: [],
    currentConversationId: getSavedConversationId(),
    loadingConversations: true,
    loadingMessages: false,
    toolkits: [],
    loadingToolkits: true,
    sending: false,
    streamingStatus: "idle",
    currentToolName: null,
    error: null,
  });

  // 本地附件映射：临时消息 ID -> 附件列表
  const localAttachmentsRef = useRef<Map<number, LocalAttachment[]>>(new Map());
  const [localAttachments, setLocalAttachments] = useState<Map<number, LocalAttachment[]>>(new Map());

  // 当前流式请求控制（用于终止）
  const activeRequestIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);

  const setError = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, error: message }));
  }, []);

  const reloadConversations = useCallback(async () => {
    setState((prev) => ({ ...prev, loadingConversations: true, error: null }));
    try {
      const res = await listAiConversations();
      setState((prev) => {
        let nextCurrent = prev.currentConversationId;
        // 验证保存的会话 ID 是否仍然存在
        if (nextCurrent && !res.items.some((c) => c.id === nextCurrent)) {
          nextCurrent = null;
          // 本地保存的会话 ID 已失效，清理 localStorage，避免下次再读到无效 ID
          try {
            localStorage.removeItem("ai_current_conversation_id");
          } catch {
            // 忽略 localStorage 错误
          }
        }
        // 如果没有当前会话，选择第一个
        if (!nextCurrent && res.items.length > 0) {
          nextCurrent = res.items[0].id;
          // 保存到 localStorage
          try {
            localStorage.setItem("ai_current_conversation_id", String(nextCurrent));
          } catch {
            // 忽略
          }
        }
        return {
          ...prev,
          conversations: res.items,
          loadingConversations: false,
          currentConversationId: nextCurrent,
        };
      });
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载会话列表失败";
      setState((prev) => ({ ...prev, loadingConversations: false, error: message }));
    }
  }, []);

  const reloadMessages = useCallback(async (conversationId?: number) => {
    const targetId = conversationId ?? state.currentConversationId;
    if (!targetId) return;

    setState((prev) => ({ ...prev, loadingMessages: true, error: null }));
    try {
      const res = await listAiMessages(targetId);
      setState((prev) => ({
        ...prev,
        messages: res.items,
        loadingMessages: false,
      }));
    } catch (err: any) {
      const status = typeof err?.status === "number" ? err.status : undefined;
      // 如果会话不存在（可能是数据库重建或会话被删除后本地仍保留旧 ID），静默清理状态
      if (status === 404) {
        try {
          localStorage.removeItem("ai_current_conversation_id");
        } catch {
          // 忽略 localStorage 错误
        }
        setState((prev) => ({
          ...prev,
          loadingMessages: false,
          currentConversationId: null,
          messages: [],
        }));
        return;
      }

      const message = typeof err?.message === "string" ? err.message : "加载消息失败";
      setState((prev) => ({ ...prev, loadingMessages: false, error: message }));
    }
  }, [state.currentConversationId]);

  const reloadToolkits = useCallback(async () => {
    setState((prev) => ({ ...prev, loadingToolkits: true }));
    try {
      const res = await listToolKits();
      setState((prev) => ({
        ...prev,
        toolkits: res.items,
        loadingToolkits: false,
      }));
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "加载工具包列表失败";
      setState((prev) => ({
        ...prev,
        loadingToolkits: false,
        error: message,
      }));
    }
  }, []);

  useEffect(() => {
    reloadConversations();
  }, [reloadConversations]);

  useEffect(() => {
    reloadToolkits();
  }, [reloadToolkits]);

  // 当 currentConversationId 变化时自动加载消息
  useEffect(() => {
    if (state.currentConversationId) {
      reloadMessages(state.currentConversationId);
    }
  }, [state.currentConversationId]); // 注意：不依赖 reloadMessages 避免循环

  const selectConversation = useCallback(async (id: number) => {
    setState((prev) => ({ ...prev, currentConversationId: id }));
    // 保存到 localStorage
    try {
      localStorage.setItem("ai_current_conversation_id", String(id));
    } catch {
      // 忽略 localStorage 错误
    }
    // 消息加载由上面的 effect 自动触发
  }, []);

  const createConversationAction = useCallback(
    async (input: CreateAiConversationRequest) => {
      setError(null);
      try {
        const res = await createAiConversation(input);
        const conv = res.conversation;
        setState((prev) => ({
          ...prev,
          conversations: [conv, ...prev.conversations],
          currentConversationId: conv.id,
          messages: [], // 新会话清空消息列表
        }));
        // 保存到 localStorage
        try {
          localStorage.setItem("ai_current_conversation_id", String(conv.id));
        } catch {
          // 忽略 localStorage 错误
        }
        // 消息加载由 effect 自动触发
        return conv;
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "创建会话失败";
        setError(message);
        throw err;
      }
    },
    [setError],
  );

  const updateConversationAction = useCallback(
    async (id: number, input: UpdateAiConversationRequest) => {
      setError(null);
      const res = await updateAiConversation(id, input);
      const conv = res.conversation;
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) => (c.id === conv.id ? conv : c)),
      }));
      return conv;
    },
    [setError],
  );

  const updateToolkitsConfig = useCallback(
    async (id: number, toolkitsConfig: ToolKitsConfig | null) => {
      return updateConversationAction(id, { toolkitsConfig } as any);
    },
    [updateConversationAction],
  );

  const deleteConversationAction = useCallback(
    async (id: number) => {
      setError(null);
      await deleteAiConversation(id);
      setState((prev) => {
        const filtered = prev.conversations.filter((c) => c.id !== id);
        const nextCurrent =
          prev.currentConversationId === id
            ? filtered.length > 0
              ? filtered[0].id
              : null
            : prev.currentConversationId;
        return {
          ...prev,
          conversations: filtered,
          currentConversationId: nextCurrent,
          messages: nextCurrent === null ? [] : prev.messages,
        };
      });
    },
    [setError],
  );

  // 用于存储流式内容的 ref（避免闭包问题）
  const streamingContentRef = useRef<string>("");

  const abortCurrentMessage = useCallback(async () => {
    const requestId = activeRequestIdRef.current;
    const controller = activeAbortControllerRef.current;
    const convId = activeConversationIdRef.current;

    if (!requestId || !controller || !convId) {
      return;
    }

    // 先本地 abort，保证 UI 立即停止
    try {
      controller.abort();
    } catch {
      // 忽略
    }

    // 再通知后端（若后端已结束/不存在则忽略错误）
    try {
      await abortAiChatMessageStream(convId, { requestId });
    } catch {
      // 忽略
    } finally {
      activeRequestIdRef.current = null;
      activeAbortControllerRef.current = null;
      activeConversationIdRef.current = null;

      setState((prev) => ({
        ...prev,
        sending: false,
        streamingStatus: "idle",
        currentToolName: null,
      }));
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string, conversationId?: number, attachments?: LocalAttachment[]) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      // 优先使用传入的 conversationId，否则使用当前选中的会话
      const convId = conversationId ?? state.currentConversationId;
      if (!convId) {
        setError("未选择会话");
        return;
      }

      const now = new Date().toISOString();
      const tempUserId = -Date.now();
      const tempAssistantId = tempUserId - 1;

      const tempUserMessage: AiChatMessage = {
        id: tempUserId,
        conversation_id: convId,
        role: "user",
        content: content || "",
        tool_name: null,
        payload: null,
        created_at: now,
      };

      const tempAssistantMessage: AiChatMessage = {
        id: tempAssistantId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        tool_name: null,
        payload: { streaming: true } as any,
        created_at: now,
      };

      // 存储本地附件
      if (attachments && attachments.length > 0) {
        localAttachmentsRef.current.set(tempUserId, attachments);
        setLocalAttachments(new Map(localAttachmentsRef.current));
      }

      // 重置流式内容
      streamingContentRef.current = "";

      setState((prev) => ({
        ...prev,
        sending: true,
        streamingStatus: "thinking",
        currentToolName: null,
        error: null,
        messages: [...prev.messages, tempUserMessage, tempAssistantMessage],
      }));

      try {
        // 为本次流式请求生成 requestId + AbortController
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const controller = new AbortController();
        activeRequestIdRef.current = requestId;
        activeAbortControllerRef.current = controller;
        activeConversationIdRef.current = convId;

        // 上传文件并获取 attachmentIds
        let attachmentIds: number[] | undefined;
        if (attachments && attachments.length > 0) {
          const filesToUpload = attachments
            .filter(a => a.file)
            .map(a => a.file!);
          
          if (filesToUpload.length > 0) {
            const uploadRes = await uploadConversationFiles(filesToUpload, convId);
            attachmentIds = uploadRes.uploads.map(u => u.id);
          }
        }

        // 使用流式 API
        await sendMessageStream({
          conversationId: convId,
          content: content || "",
          attachmentIds,
          requestId,
          signal: controller.signal,
          onReceived: (event) => {
            // 更新用户消息 ID
            setState((prev) => ({
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === tempUserId
                  ? { ...m, id: event.data.userMessageId }
                  : m
              ),
            }));
          },
          onThinking: () => {
            setState((prev) => ({
              ...prev,
              streamingStatus: "thinking",
              currentToolName: null,
            }));
          },
          onDelta: (event) => {
            // 累积流式内容
            streamingContentRef.current += event.data.content;
            const currentContent = streamingContentRef.current;
            
            setState((prev) => ({
              ...prev,
              streamingStatus: "streaming",
              messages: prev.messages.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, content: currentContent }
                  : m
              ),
            }));
          },
          onToolStart: (event) => {
            setState((prev) => ({
              ...prev,
              streamingStatus: "tool",
              currentToolName: event.data.toolName,
            }));
          },
          onToolEnd: () => {
            setState((prev) => ({
              ...prev,
              streamingStatus: "thinking",
              currentToolName: null,
            }));
          },
          onFinal: (event) => {
            // 用最终消息替换临时消息
            // 优先使用 delta 累积的内容（流式过程中已收到），否则使用 final 事件的内容
            const streamedContent = streamingContentRef.current;
            const finalContent = streamedContent || event.data.content;
            
            const finalMessage: AiChatMessage = {
              id: event.data.assistantMessageId,
              conversation_id: convId,
              role: "assistant",
              content: finalContent,
              tool_name: null,
              payload: {
                toolResults: event.data.toolResults,
              },
              created_at: now,
            };

            // 清理临时附件
            localAttachmentsRef.current.delete(tempUserId);
            setLocalAttachments(new Map(localAttachmentsRef.current));

            setState((prev) => ({
              ...prev,
              sending: false,
              streamingStatus: "idle",
              currentToolName: null,
              messages: prev.messages.map((m) =>
                m.id === tempAssistantId ? finalMessage : m
              ),
            }));

            activeRequestIdRef.current = null;
            activeAbortControllerRef.current = null;
            activeConversationIdRef.current = null;

            // 重新加载会话列表，以便获取后端自动命名后的标题
            void reloadConversations();
          },
          onError: (event) => {
            // 清理临时附件
            localAttachmentsRef.current.delete(tempUserId);
            setLocalAttachments(new Map(localAttachmentsRef.current));

            setState((prev) => ({
              ...prev,
              sending: false,
              streamingStatus: "idle",
              currentToolName: null,
              error: event.data.message,
              messages: prev.messages.filter(
                (m) => m.id !== tempUserId && m.id !== tempAssistantId,
              ),
            }));

            activeRequestIdRef.current = null;
            activeAbortControllerRef.current = null;
            activeConversationIdRef.current = null;
          },
        });
      } catch (err: any) {
        // 清理临时附件
        localAttachmentsRef.current.delete(tempUserId);
        setLocalAttachments(new Map(localAttachmentsRef.current));
        
        // 如果是请求被中止，静默处理
        const isAborted = err?.name === "AbortError" || 
          (typeof err?.message === "string" && err.message.includes("aborted"));
        
        if (isAborted) {
          setState((prev) => ({
            ...prev,
            sending: false,
            streamingStatus: "idle",
            currentToolName: null,
            messages: prev.messages.filter(
              (m) => m.id !== tempUserId && m.id !== tempAssistantId,
            ),
          }));

          activeRequestIdRef.current = null;
          activeAbortControllerRef.current = null;
          activeConversationIdRef.current = null;
          return;
        }
        
        const message = typeof err?.message === "string" ? err.message : "发送消息失败";
        setState((prev) => ({
          ...prev,
          sending: false,
          streamingStatus: "idle",
          currentToolName: null,
          error: message,
          messages: prev.messages.filter(
            (m) => m.id !== tempUserId && m.id !== tempAssistantId,
          ),
        }));

        activeRequestIdRef.current = null;
        activeAbortControllerRef.current = null;
        activeConversationIdRef.current = null;
      }
    },
    [state.currentConversationId, setError, reloadConversations],
  );

  // 执行工具操作
  const executeTool = useCallback(
    async (toolName: string, args: Record<string, any>) => {
      try {
        const result = await executeAiTool({
          toolName,
          args,
          conversationId: state.currentConversationId ?? undefined,
        });
        return result;
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "执行工具失败";
        setError(message);
        throw err;
      }
    },
    [state.currentConversationId, setError],
  );

  return {
    ...state,
    localAttachments,
    reloadConversations,
    reloadMessages,
    reloadToolkits,
    selectConversation,
    createConversation: createConversationAction,
    updateConversation: updateConversationAction,
    updateToolkitsConfig,
    deleteConversation: deleteConversationAction,
    sendMessage,
    abortCurrentMessage,
    executeTool,
  };
};
