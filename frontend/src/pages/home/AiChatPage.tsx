import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAiChat } from "@/hooks/useAiChat";
import { useAiConfig } from "@/hooks/useAiConfig";
import { AiConversationDialog } from "@/components/aichat/dialog/AiConversationDialog";
import { AiToolkitsDialog } from "@/components/aichat/dialog/AiToolkitsDialog";
import { ChatMessageList } from "@/components/aichat/ChatMessageList";
import { ChatInputBar } from "@/components/aichat/ChatInputBar";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { GlassLabel } from "@/components/common/label/GlassLabel";
import type { ToolKitsConfig } from "@/lib/api/aiChat";
import { MessageCircle, Sparkles, Wrench } from "lucide-react";
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
    toolkits,
    loadingToolkits,
    sending,
    error,
    localAttachments,
    selectConversation,
    createConversation,
    updateConversation,
    updateToolkitsConfig,
    deleteConversation,
    sendMessage,
    executeTool,
  } = useAiChat();

  const { models } = useAiConfig();

  const [creating, setCreating] = useState(false);
  const [conversationPanelOpen, setConversationPanelOpen] = useState(false);
  const [toolkitsDialogOpen, setToolkitsDialogOpen] = useState(false);
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
    setConversationPanelOpen(false);
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

  const handleSaveToolkitsConfig = async (config: ToolKitsConfig | null) => {
    if (!currentConversation) return;
    await updateToolkitsConfig(currentConversation.id, config);
  };

  return (
    <PageContainer
      title="AI 助手"
      leftAction={
        models && models.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassIconButton
                type="button"
                glassVariant="lite"
                title={`切换模型 (${currentModel?.display_name ?? "未设置"})`}
              >
                <Sparkles className="h-5 w-5" />
              </GlassIconButton>
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
        ) : null
      }
      headerCenter={
        <div className="min-w-0 max-w-[60%] flex justify-center">
          <GlassLabel
            glassVariant="lite"
            className={cn("h-9 px-6 max-w-full", DS.text.heading)}
            title={
              currentConversation
                ? currentConversation.title || `会话 #${currentConversation.id}`
                : "新会话"
            }
          >
            <span className="truncate text-sm text-foreground">
              {currentConversation
                ? currentConversation.title || `会话 #${currentConversation.id}`
                : "新会话"}
            </span>
          </GlassLabel>
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          <GlassIconButton
            glassVariant="lite"
            className={cn("h-9 w-9", toolkitsDialogOpen && "border-primary/30 bg-primary/10")}
            onClick={() => setToolkitsDialogOpen(true)}
            disabled={!currentConversation}
            title="工具包设置"
          >
            <Wrench className="h-5 w-5" />
          </GlassIconButton>

          <GlassIconButton
            glassVariant="lite"
            className={cn("h-9 w-9", conversationPanelOpen && "border-primary/30 bg-primary/10")}
            onClick={() => setConversationPanelOpen((open) => !open)}
            disabled={loadingConversations}
            title="切换会话"
          >
            <MessageCircle className="h-5 w-5" />
          </GlassIconButton>
        </div>
      }
      className="h-full flex flex-col"
      headerOverlay
      headerOverlayMaskClassName="h-[calc(176px+env(safe-area-inset-top))]"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Main Chat Container - Transparent/Ghost */}
        <div className="relative flex-1 min-h-0 flex flex-col">
          <div
            ref={scrollContainerRef}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto scroll-smooth scrollbar-none",
              "-mx-6 md:-mx-12"
            )}
          >
            <div className={cn("px-6 md:px-12", "pt-[calc(176px+env(safe-area-inset-top)+12px)] pb-32")}
            >
              <ChatMessageList
                messages={messages}
                loading={loadingMessages}
                localAttachments={localAttachments}
                onToolConfirm={handleToolConfirm}
                onToolCancel={handleToolCancel}
              />
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

      <AiConversationDialog
        open={conversationPanelOpen}
        onOpenChange={setConversationPanelOpen}
        conversations={conversations}
        currentId={currentConversationId}
        loading={loadingConversations}
        onSelect={handleSelectConversationFromPanel}
        onNewConversation={handleCreateConversation}
        onDelete={deleteConversation}
      />

      <AiToolkitsDialog
        open={toolkitsDialogOpen}
        onOpenChange={setToolkitsDialogOpen}
        conversation={currentConversation}
        toolkits={toolkits}
        loadingToolkits={loadingToolkits}
        onSave={handleSaveToolkitsConfig}
      />

    </PageContainer>
  );
}
