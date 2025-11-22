import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiConfig } from "@/hooks/useAiConfig";
import { AiMobileConversationManager } from "@/components/ai/AiMobileConversationManager";
import { ChatMessageList } from "@/components/ai/ChatMessageList";
import { ChatInputBar } from "@/components/ai/ChatInputBar";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export function AiChatPage() {
  const {
    conversations,
    messages,
    currentConversationId,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    reloadConversations,
    selectConversation,
    createConversation,
    updateConversation,
    sendMessage,
  } = useAiChat();

  const { models } = useAiConfig();

  const [creating, setCreating] = useState(false);
  const [conversationPanelOpen, setConversationPanelOpen] = useState(false);

  const handleCreateConversation = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const title = `新会话 ${new Date().toLocaleString()}`;
      await createConversation({ title });
    } catch {
      // 错误信息由 useAiChat 内部的 error 状态进行展示
    } finally {
      setCreating(false);
    }
  };

  const currentConversation = conversations.find((c) => c.id === currentConversationId) ?? null;

  return (
    <PageContainer
      title="AI 助手"
      className="h-full flex flex-col"
    >
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      <div className="flex h-full min-h-0 flex-col">
        <div className="relative flex-1 min-h-0 rounded-xl border bg-background ">
          <div className="h-full overflow-y-auto rounded-xl ">
            <ChatMessageList
              messages={messages}
              loading={loadingMessages}
              onReloadConversations={reloadConversations}
              reloadingConversations={loadingConversations}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-2">
            <div className="pointer-events-auto space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="min-w-0">
                  <div className="inline-flex max-w-full items-center rounded-full border bg-card px-3 py-1 shadow-sm">
                    <span className="truncate text-sm font-medium text-foreground">
                      {currentConversation
                        ? currentConversation.title || `会话 #${currentConversation.id}`
                        : "尚未选择会话"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-sm"
                    onClick={() => setConversationPanelOpen((open) => !open)}
                    disabled={loadingConversations}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {conversationPanelOpen && (
                <AiMobileConversationManager
                  conversations={conversations}
                  currentId={currentConversationId}
                  loading={loadingConversations}
                  onSelect={selectConversation}
                  onNewConversation={handleCreateConversation}
                />
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
            <div className="pointer-events-auto">
              <ChatInputBar
                sending={sending}
                onSend={async (content) => sendMessage(content)}
                models={models}
                currentModelId={currentConversation?.model_id ?? null}
                onChangeModel={async (modelId: number) => {
                  if (!currentConversation) return;
                  await updateConversation(currentConversation.id, { modelId });
                }}
              />
            </div>
          </div>
        </div>
      </div>

    </PageContainer>
  );
}
