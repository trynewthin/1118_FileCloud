import { useCallback, useEffect, useState, useRef } from "react";
import type {
  AiChatConversation,
  AiChatMessage,
  CreateAiConversationRequest,
  UpdateAiConversationRequest,
} from "@/lib/api/aiChat";
import {
  listAiConversations,
  listAiMessages,
  createAiConversation,
  updateAiConversation,
  deleteAiConversation,
  appendUserMessage,
  uploadAiImages,
  executeAiTool,
} from "@/lib/api/aiChat";
import type { LocalAttachment } from "@/lib/types/aiChat";

// 重新导出类型以保持向后兼容
export type { LocalAttachment } from "@/lib/types/aiChat";

interface AiChatState {
  conversations: AiChatConversation[];
  messages: AiChatMessage[];
  currentConversationId: number | null;
  loadingConversations: boolean;
  loadingMessages: boolean;
  sending: boolean;
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
    sending: false,
    error: null,
  });

  // 本地附件映射：临时消息 ID -> 附件列表
  const localAttachmentsRef = useRef<Map<number, LocalAttachment[]>>(new Map());
  const [localAttachments, setLocalAttachments] = useState<Map<number, LocalAttachment[]>>(new Map());

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
      const message = typeof err?.message === "string" ? err.message : "加载消息失败";
      setState((prev) => ({ ...prev, loadingMessages: false, error: message }));
    }
  }, [state.currentConversationId]);

  useEffect(() => {
    reloadConversations();
  }, [reloadConversations]);

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
        content: "...",
        tool_name: null,
        payload: { placeholder: true } as any,
        created_at: now,
      };

      // 存储本地附件
      if (attachments && attachments.length > 0) {
        localAttachmentsRef.current.set(tempUserId, attachments);
        setLocalAttachments(new Map(localAttachmentsRef.current));
      }

      setState((prev) => ({
        ...prev,
        sending: true,
        error: null,
        messages: [...prev.messages, tempUserMessage, tempAssistantMessage],
      }));
      try {
        // 上传图片并获取 attachmentIds
        let attachmentIds: number[] | undefined;
        if (attachments && attachments.length > 0) {
          const filesToUpload = attachments
            .filter(a => a.file)
            .map(a => a.file!);
          
          if (filesToUpload.length > 0) {
            const uploadRes = await uploadAiImages(filesToUpload);
            attachmentIds = uploadRes.uploads.map(u => u.id);
          }
        }

        await appendUserMessage(convId, { 
          content: content || "", 
          attachmentIds,
        });
        
        // 清理临时附件
        localAttachmentsRef.current.delete(tempUserId);
        setLocalAttachments(new Map(localAttachmentsRef.current));
        
        setState((prev) => ({
          ...prev,
          sending: false,
        }));
        // 重新加载消息列表，以获取工具调用消息
        await reloadMessages(convId);
        // 重新加载会话列表，以便获取后端自动命名后的标题
        void reloadConversations();
      } catch (err: any) {
        // 清理临时附件
        localAttachmentsRef.current.delete(tempUserId);
        setLocalAttachments(new Map(localAttachmentsRef.current));
        
        const message = typeof err?.message === "string" ? err.message : "发送消息失败";
        setState((prev) => ({
          ...prev,
          sending: false,
          error: message,
          messages: prev.messages.filter(
            (m) => m.id !== tempUserId && m.id !== tempAssistantId,
          ),
        }));
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
    selectConversation,
    createConversation: createConversationAction,
    updateConversation: updateConversationAction,
    deleteConversation: deleteConversationAction,
    sendMessage,
    executeTool,
  };
};
