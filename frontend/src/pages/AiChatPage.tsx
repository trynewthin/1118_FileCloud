import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiConfig } from "@/hooks/useAiConfig";
import { AiMobileConversationManager } from "@/components/ai/AiMobileConversationManager";
import { ChatMessageList } from "@/components/ai/ChatMessageList";
import { ChatInputBar } from "@/components/ai/ChatInputBar";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { MessageCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

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

  const handleSelectConversationFromPanel = (id: number) => {
    selectConversation(id);
    setConversationPanelOpen(true);
  };

  const currentConversation = conversations.find((c) => c.id === currentConversationId) ?? null;

  return (
    <PageContainer
      title="AI 助手"
      className="h-full flex flex-col"
    >
      {error && <div className="mb-4 text-sm text-red-500 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-md">{error}</div>}

      <div className="flex h-full min-h-0 flex-col">
        {/* Main Chat Container - Transparent/Ghost */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto h-full scroll-smooth px-2 scrollbar-none">
            <div className="pt-24 pb-32"> {/* Spacer for header and bottom input bar */}
              <ChatMessageList
                messages={messages}
                loading={loadingMessages}
                onReloadConversations={reloadConversations}
                reloadingConversations={loadingConversations}
              />
            </div>
          </div>

          {/* Floating Header Overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-3 z-20">
            <div className="pointer-events-auto space-y-2">
              <div className="flex items-center justify-center relative h-9">
                {/* Left: Reload Button */}
                <div className="absolute left-0 top-0 flex items-center">
                  <GlassButton
                    glassVariant="lite"
                    size="icon"
                    className="h-9 w-9 rounded-full shadow-sm"
                    onClick={() => reloadConversations()}
                    disabled={loadingConversations}
                    title="刷新会话"
                  >
                    <RefreshCw className={cn("h-4 w-4", loadingConversations && "animate-spin")} />
                  </GlassButton>
                </div>

                {/* Center: Title Capsule */}
                <div className="min-w-0 max-w-[60%] flex justify-center">
                  <GlassCard 
                    variant="lite" 
                    className={cn(
                      "inline-flex items-center px-6 py-2 max-w-full shadow-sm backdrop-blur-md border-white/10",
                      DS.radius.full
                    )}
                  >
                    <span className="truncate text-sm font-medium text-foreground/90">
                      {currentConversation
                        ? currentConversation.title || `会话 #${currentConversation.id}`
                        : "新会话"}
                    </span>
                  </GlassCard>
                </div>

                {/* Right: History Toggle */}
                <div className="absolute right-0 top-0 flex items-center">
                  <GlassButton
                    glassVariant="lite"
                    size="icon"
                    className="h-9 w-9 rounded-full shadow-sm"
                    onClick={() => setConversationPanelOpen((open) => !open)}
                    disabled={loadingConversations}
                    title="切换会话"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </GlassButton>
                </div>
              </div>

              {conversationPanelOpen && (
                <div className="mt-2 mr-2 flex justify-end">
                  <AiMobileConversationManager
                    conversations={conversations}
                    currentId={currentConversationId}
                    loading={loadingConversations}
                    onSelect={handleSelectConversationFromPanel}
                    onNewConversation={handleCreateConversation}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Floating Input Bar Overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-6 pt-4 z-20">
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
