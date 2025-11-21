import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiConfig } from "@/hooks/useAiConfig";
import { AiConversationList } from "@/components/ai/AiConversationList";
import { AiMobileConversationManager } from "@/components/ai/AiMobileConversationManager";
import { ChatMessageList } from "@/components/ai/ChatMessageList";
import { ChatInputBar } from "@/components/ai/ChatInputBar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

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
      action={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => reloadConversations()}
            disabled={loadingConversations}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loadingConversations ? "animate-spin" : ""}`}
            />
            刷新会话
          </Button>
          <Button size="sm" onClick={handleCreateConversation} disabled={creating}>
            {creating ? "创建中..." : "新建会话"}
          </Button>
        </div>
      }
      className="h-full flex flex-col"
    >
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      <div className="mt-4 h-full min-h-0 md:grid md:grid-cols-[260px_minmax(0,1fr)] md:gap-4">
        <div className="hidden md:block h-full min-h-0">
          <AiConversationList
            conversations={conversations}
            currentId={currentConversationId}
            loading={loadingConversations}
            onSelect={selectConversation}
            onNewConversation={handleCreateConversation}
          />
        </div>

        <div className="mt-4 flex h-full min-h-0 flex-col gap-3 md:mt-0">
          <div className="md:hidden">
            <AiMobileConversationManager
              conversations={conversations}
              currentId={currentConversationId}
              loading={loadingConversations}
              onSelect={selectConversation}
              onNewConversation={handleCreateConversation}
            />
          </div>

          <div className="hidden md:flex rounded-lg border bg-card px-3 py-2 items-center justify-between text-xs text-muted-foreground">
            <div>
              {currentConversation ? (
                <span className="font-medium text-sm text-foreground">
                  {currentConversation.title || `会话 #${currentConversation.id}`}
                </span>
              ) : (
                <span>尚未选择会话</span>
              )}
            </div>
            {currentConversation && (
              <div className="flex items-center gap-2">
                <span>模型：</span>
                <Select
                  value={String(currentConversation.model_id)}
                  onValueChange={async (value) => {
                    const modelId = Number(value);
                    if (!Number.isInteger(modelId) || modelId <= 0) return;
                    await updateConversation(currentConversation.id, { modelId });
                  }}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)} disabled={!m.is_enabled}>
                        {m.display_name}
                        {!m.is_enabled ? "（已禁用）" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 rounded-lg border bg-background px-3 py-2 overflow-y-auto">
            <ChatMessageList messages={messages} loading={loadingMessages} />
          </div>

          <div className="rounded-lg border bg-card px-3 py-2">
            <ChatInputBar sending={sending} onSend={async (content) => sendMessage(content)} />
          </div>
        </div>
      </div>

    </PageContainer>
  );
}
