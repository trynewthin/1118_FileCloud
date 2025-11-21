import { useCallback, useEffect, useState } from "react";
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
} from "@/lib/api/aiChat";

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
  const [state, setState] = useState<AiChatState>({
    conversations: [],
    messages: [],
    currentConversationId: null,
    loadingConversations: true,
    loadingMessages: false,
    sending: false,
    error: null,
  });

  const setError = useCallback((message: string | null) => {
    setState((prev) => ({ ...prev, error: message }));
  }, []);

  const reloadConversations = useCallback(async () => {
    setState((prev) => ({ ...prev, loadingConversations: true, error: null }));
    try {
      const res = await listAiConversations();
      setState((prev) => {
        let nextCurrent = prev.currentConversationId;
        if (!nextCurrent && res.items.length > 0) {
          nextCurrent = res.items[0].id;
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

  const selectConversation = useCallback(async (id: number) => {
    setState((prev) => ({ ...prev, currentConversationId: id }));
    await reloadMessages(id);
  }, [reloadMessages]);

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
        }));
        await reloadMessages(conv.id);
        return conv;
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "创建会话失败";
        setError(message);
        throw err;
      }
    },
    [reloadMessages, setError],
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
    async (content: string) => {
      if (!content.trim()) return;

      const convId = state.currentConversationId;
      if (!convId) {
        setError("未选择会话");
        return;
      }

      setState((prev) => ({ ...prev, sending: true, error: null }));
      try {
        const res = await appendUserMessage(convId, { content });
        setState((prev) => ({
          ...prev,
          sending: false,
          messages: [...prev.messages, res.userMessage, res.assistantMessage],
        }));
        // 重新加载会话列表，以便获取后端自动命名后的标题
        void reloadConversations();
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "发送消息失败";
        setState((prev) => ({ ...prev, sending: false, error: message }));
      }
    },
    [state.currentConversationId, setError, reloadConversations],
  );

  return {
    ...state,
    reloadConversations,
    reloadMessages,
    selectConversation,
    createConversation: createConversationAction,
    updateConversation: updateConversationAction,
    deleteConversation: deleteConversationAction,
    sendMessage,
  };
};
