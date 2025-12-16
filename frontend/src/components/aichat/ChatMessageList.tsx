import type { AiChatMessage } from "@/lib/api/aiChat";
import type { LocalAttachment } from "@/lib/types/aiChat";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { GlassCard } from "@/components/common/GlassCard";
import type { PendingAction } from "./ToolCallRenderer";
import { AssistantMessage, UserMessageBubble, type StreamingStatus } from "./ChatMessageBubbles";
import { useMemo } from "react";

interface ChatMessageListProps {
  messages: AiChatMessage[];
  loading: boolean;
  // 本地附件映射：临时消息 ID -> 附件列表
  localAttachments?: Map<number, LocalAttachment[]>;
  // 工具确认回调
  onToolConfirm?: (action: PendingAction) => void;
  onToolCancel?: (action: PendingAction) => void;
  /** 流式状态 */
  streamingStatus?: StreamingStatus;
  /** 当前正在执行的工具名称 */
  currentToolName?: string | null;
}

export function ChatMessageList({
  messages,
  loading,
  localAttachments,
  onToolConfirm,
  onToolCancel,
  streamingStatus = "idle",
  currentToolName = null,
}: ChatMessageListProps) {
  // 预处理消息：从 assistant.payload.toolResults 读取工具结果，跳过独立的 role=tool 消息
  const processedMessages = useMemo(() => {
    const result: Array<{
      message: AiChatMessage;
      toolResults: Array<{ result: any; pendingAction?: PendingAction }>;
      showAvatar: boolean;
    }> = [];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];

      // 跳过独立的 tool 消息（历史数据兼容）
      if (m.role === "tool") {
        continue;
      }

      // 判断是否显示头像
      const prevItem = result.length > 0 ? result[result.length - 1] : null;
      const isAiLike = m.role === "assistant";
      const prevIsAiLike = prevItem && prevItem.message.role === "assistant";
      const prevIsUser = prevItem && prevItem.message.role === "user";

      let showAvatar = true;
      if (isAiLike && prevIsAiLike) {
        showAvatar = false;
      } else if (m.role === "user" && prevIsUser) {
        showAvatar = false;
      }

      // 从 assistant payload 读取 toolResults
      let toolResults: Array<{ result: any; pendingAction?: PendingAction }> = [];
      if (m.role === "assistant" && m.payload?.toolResults) {
        const payloadToolResults = m.payload.toolResults as Array<{
          result?: any;
          pendingAction?: PendingAction;
        }>;
        toolResults = payloadToolResults
          .filter((tr) => tr.result)
          .map((tr) => ({ result: tr.result, pendingAction: tr.pendingAction }));
      }

      result.push({
        message: m,
        toolResults,
        showAvatar,
      });
    }

    return result;
  }, [messages]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      {loading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground/50 gap-3 animate-pulse">
          <Bot className="h-8 w-8 opacity-20" />
          <span className="text-xs">思考中...</span>
        </div>
      )}
      {!loading && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground/50 gap-4">
          <div className="p-4 rounded-full bg-primary/5 border border-primary/10">
            <Bot className="h-8 w-8 text-primary/40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">AI 助手准备就绪</p>
            <p className="text-xs opacity-70">发送消息开始对话</p>
          </div>
        </div>
      )}
      
      {processedMessages.map(({ message: m, toolResults, showAvatar }) => {
        const isAssistant = m.role === "assistant";
        const isSystem = m.role === "system";
        const isUser = m.role === "user";

        // 系统消息
        if (isSystem) {
          return (
            <div key={m.id} className="flex w-full justify-center my-2">
              <div className="bg-muted/30 backdrop-blur-sm border border-white/5 rounded-full px-3 py-1 text-[10px] text-muted-foreground">
                {m.content || "系统消息"}
              </div>
            </div>
          );
        }

        // AI 头像组件（复用）
        const AiAvatar = showAvatar ? (
          <GlassCard
            variant="lite"
            className={cn(
              "shrink-0 h-7 w-7 md:h-8 md:w-8",
              "flex items-center justify-center shadow-sm",
              cn(DS.radius.full, "button-rect:rounded-xl"),
              "text-primary border-primary/20"
            )}
          >
            <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
            <Bot className="relative z-10 h-3.5 w-3.5 md:h-4 md:w-4" />
          </GlassCard>
        ) : (
          // 占位符，保持对齐
          <div className="shrink-0 h-7 w-7 md:h-8 md:w-8" />
        );

        // AI 消息
        if (isAssistant) {
          return (
            <div key={m.id} className="flex w-full justify-start">
              <div className="flex flex-col md:flex-row gap-2 md:gap-3 max-w-[90%] md:max-w-[75%]">
                {AiAvatar}
                <AssistantMessage 
                  content={m.content || ""} 
                  toolResults={toolResults}
                  onToolConfirm={onToolConfirm}
                  onToolCancel={onToolCancel}
                  loading={loading}
                  streamingStatus={m.payload?.streaming ? streamingStatus : "idle"}
                  currentToolName={m.payload?.streaming ? currentToolName : null}
                />
              </div>
            </div>
          );
        }

        // 用户消息
        if (isUser) {
          return (
            <div key={m.id} className="flex w-full justify-end">
              <div className="flex flex-col md:flex-row-reverse gap-2 md:gap-3 items-end md:items-start max-w-[90%] md:max-w-[75%]">
                {showAvatar ? (
                  <GlassCard
                    variant="lite"
                    className={cn(
                      "shrink-0 h-7 w-7 md:h-8 md:w-8",
                      "flex items-center justify-center shadow-sm",
                      cn(DS.radius.full, "button-rect:rounded-xl"),
                      "text-muted-foreground"
                    )}
                  >
                    <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
                    <User className="relative z-10 h-3.5 w-3.5 md:h-4 md:w-4" />
                  </GlassCard>
                ) : (
                  <div className="shrink-0 h-7 w-7 md:h-8 md:w-8" />
                )}
                <UserMessageBubble
                  message={m}
                  localAttachments={localAttachments?.get(m.id)}
                />
              </div>
            </div>
          );
        }

        return null;
      })}
      
    </div>
  );
}
