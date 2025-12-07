import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiConfig } from "@/hooks/useAiConfig";
import { AiMobileConversationManager } from "@/components/ai/AiMobileConversationManager";
import { ChatMessageList } from "@/components/ai/ChatMessageList";
import { ChatInputBar } from "@/components/ai/ChatInputBar";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { MessageCircle, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

export function AiChatPage() {
  const {
    conversations,
    messages,
    currentConversationId,
    loadingConversations,
    loadingMessages,
    sending,
    error,
    localAttachments,
    selectConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    sendMessage,
    executeTool,
  } = useAiChat();

  const { models } = useAiConfig();

  const [creating, setCreating] = useState(false);
  const [conversationPanelOpen, setConversationPanelOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // 消息变化时自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

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

  // 发送消息：如果没有当前会话，先自动创建一个
  const handleSendMessage = async (content: string, attachments?: File[]) => {
    // 将 File 转换为 LocalAttachment（包含 file 用于上传）
    const localAtts = attachments?.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      previewUrl: URL.createObjectURL(file),
      file,  // 保留原始文件用于上传
    }));
    if (!currentConversationId) {
      // 没有当前会话，先创建一个新会话
      const title = `新会话 ${new Date().toLocaleString()}`;
      const newConv = await createConversation({ title });
      if (newConv) {
        // 创建成功后发送消息，传入新会话 ID
        await sendMessage(content, newConv.id, localAtts);
      }
    } else {
      await sendMessage(content, undefined, localAtts);
    }
  };

  const currentConversation = conversations.find((c) => c.id === currentConversationId) ?? null;

  // 当前模型
  const currentModel = models?.find((m) => m.id === currentConversation?.model_id) ?? null;

  // 切换模型
  const handleChangeModel = async (modelId: number) => {
    if (!currentConversation) return;
    await updateConversation(currentConversation.id, { modelId });
  };

  // 工具确认回调
  const handleToolConfirm = async (action: { toolName: string; args: Record<string, any> }) => {
    try {
      await executeTool(action.toolName, action.args);
    } catch {
      // 错误已在 hook 中处理
    }
  };

  const handleToolCancel = (_action: { toolName: string; args: Record<string, any> }) => {
    // 取消操作，无需处理
  };

  return (
    <PageContainer
      title="AI 助手"
      className="h-full flex flex-col"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Main Chat Container - Transparent/Ghost */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto h-full scroll-smooth px-2 scrollbar-none">
            <div className="pt-24 pb-32"> {/* Spacer for header and bottom input bar */}
              <ChatMessageList
                messages={messages}
                loading={loadingMessages}
                localAttachments={localAttachments}
                onToolConfirm={handleToolConfirm}
                onToolCancel={handleToolCancel}
              />
            </div>
          </div>

          {/* Floating Header Overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-2 pt-3">
            <div className="pointer-events-auto space-y-2 relative">
              <div className="flex items-center justify-center relative h-9">
                {/* Left: Model Selector */}
                {models && models.length > 0 && (
                  <div className="absolute left-0 top-0 flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <GlassButton
                          type="button"
                          size="icon"
                          glassVariant="lite"
                          className="h-9 w-9 rounded-full shadow-sm"
                          title={`切换模型 (${currentModel?.display_name ?? "未设置"})`}
                        >
                          <Sparkles className="h-5 w-5 text-primary" />
                        </GlassButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className={cn("w-56", DS.glass.strong, "border-white/10")}>
                        <DropdownMenuLabel className="text-xs">
                          当前模型：{currentModel ? currentModel.display_name : "未设置"}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        {models.map((m) => (
                          <DropdownMenuItem
                            key={m.id}
                            disabled={!m.is_enabled}
                            className="text-xs focus:bg-primary/10 focus:text-primary"
                            onClick={() => handleChangeModel(m.id)}
                          >
                            <span className="truncate">
                              {m.display_name}
                              {!m.is_enabled ? "（已禁用）" : ""}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {/* Center: Title Capsule */}
                <div className="min-w-0 max-w-[60%] flex justify-center">
                  <GlassCard 
                    variant="lite" 
                    className={cn(
                      "inline-flex items-center px-6 py-2 max-w-full shadow-sm border-primary/20",
                      DS.radius.full
                    )}
                  >
                    <span className={cn("truncate text-sm text-primary", DS.text.heading)}>
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
                    className={cn(
                      "h-9 w-9 rounded-full shadow-sm",
                      conversationPanelOpen && "border-primary/30 bg-primary/10"
                    )}
                    onClick={() => setConversationPanelOpen((open) => !open)}
                    disabled={loadingConversations}
                    title="切换会话"
                  >
                    <MessageCircle className={cn("h-5 w-5", conversationPanelOpen ? "text-primary" : "text-muted-foreground")} />
                  </GlassButton>
                </div>
              </div>

              {conversationPanelOpen && (
                <>
                  {/* 点击遮罩关闭面板 */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setConversationPanelOpen(false)}
                  />
                  <div className="mt-2 mr-2 flex justify-end relative z-20">
                    <AiMobileConversationManager
                      conversations={conversations}
                      currentId={currentConversationId}
                      loading={loadingConversations}
                      onSelect={handleSelectConversationFromPanel}
                      onNewConversation={handleCreateConversation}
                      onDelete={deleteConversation}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Floating Input Bar Overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-4 pt-4">
            <div className="pointer-events-auto relative">
              <ChatInputBar
                sending={sending}
                onSend={handleSendMessage}
              />
            </div>
          </div>
        </div>
      </div>

    </PageContainer>
  );
}
