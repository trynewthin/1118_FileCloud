import type { AiChatMessage } from "@/lib/api/aiChat";
import type { LocalAttachment } from "@/lib/types/aiChat";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { GlassCard } from "@/components/common/GlassCard";
import type { PendingAction } from "./ToolCallRenderer";
import { AssistantMessage, UserMessageBubble, BOTTOM_TOOL_TYPES } from "./ChatMessageBubbles";
import { useMemo } from "react";

interface ChatMessageListProps {
  messages: AiChatMessage[];
  loading: boolean;
  // 本地附件映射：临时消息 ID -> 附件列表
  localAttachments?: Map<number, LocalAttachment[]>;
  // 工具确认回调
  onToolConfirm?: (action: PendingAction) => void;
  onToolCancel?: (action: PendingAction) => void;
}

export function ChatMessageList({
  messages,
  loading,
  localAttachments,
  onToolConfirm,
  onToolCancel,
}: ChatMessageListProps) {
  // 预处理消息：将工具消息合并到 AI 消息，并计算是否显示头像
  // - 普通工具结果：合并到前一个 AI 消息（显示在上方）
  // - file_display 类型：合并到后一个 AI 消息（显示在下方）
  const processedMessages = useMemo(() => {
    const result: Array<{
      message: AiChatMessage;
      toolResults: Array<{ result: any; pendingAction?: PendingAction }>;
      showAvatar: boolean; // 是否显示头像
    }> = [];
    
    // 第一遍：收集需要延迟合并的 file_display 工具结果
    const pendingBottomTools: Array<{ result: any; pendingAction?: PendingAction }> = [];
    
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      
      if (m.role === "tool" && m.payload) {
        const toolResult = m.payload as { result?: any; pendingAction?: PendingAction };
        if (toolResult.result) {
          // 判断是否是需要放在下方的工具类型
          const isBottomType = BOTTOM_TOOL_TYPES.has(toolResult.result.type);
          
          if (isBottomType) {
            // 延迟合并到下一个 AI 消息
            pendingBottomTools.push({
              result: toolResult.result,
              pendingAction: toolResult.pendingAction,
            });
            continue;
          }
          
          // 普通工具结果：合并到前一个 AI 消息
          if (result.length > 0) {
            const lastItem = result[result.length - 1];
            if (lastItem.message.role === "assistant" || lastItem.message.role === "tool") {
              lastItem.toolResults.push({
                result: toolResult.result,
                pendingAction: toolResult.pendingAction,
              });
              continue;
            }
          }
        }
      }
      
      // 判断是否需要显示头像：如果前一条消息是同类型（AI/工具 或 用户），则不显示
      const prevItem = result.length > 0 ? result[result.length - 1] : null;
      const isAiLike = m.role === "assistant" || m.role === "tool";
      const prevIsAiLike = prevItem && (prevItem.message.role === "assistant" || prevItem.message.role === "tool");
      const prevIsUser = prevItem && prevItem.message.role === "user";
      
      let showAvatar = true;
      if (isAiLike && prevIsAiLike) {
        showAvatar = false;
      } else if (m.role === "user" && prevIsUser) {
        showAvatar = false;
      }
      
      // 如果是 AI 消息，把之前积累的 pendingBottomTools 合并进来
      if (m.role === "assistant" && pendingBottomTools.length > 0) {
        result.push({
          message: m,
          toolResults: [...pendingBottomTools],
          showAvatar,
        });
        pendingBottomTools.length = 0; // 清空
      } else {
        result.push({
          message: m,
          toolResults: [],
          showAvatar,
        });
      }
    }
    
    // 如果还有未合并的 pendingBottomTools，合并到最后一个 AI 消息
    if (pendingBottomTools.length > 0 && result.length > 0) {
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].message.role === "assistant") {
          result[i].toolResults.push(...pendingBottomTools);
          break;
        }
      }
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
        const isTool = m.role === "tool";
        const isAiLike = isAssistant || isTool;

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

        // 独立的工具消息（未能合并到 AI 消息的）- 使用 AI 头像
        if (isTool && m.payload) {
          const toolResult = m.payload as { result?: any; pendingAction?: PendingAction };
          if (toolResult.result) {
            return (
              <div key={m.id} className="flex w-full justify-start">
                <div className="flex flex-col md:flex-row gap-2 md:gap-3 max-w-[90%] md:max-w-[75%]">
                  {AiAvatar}
                  <AssistantMessage 
                    content="" 
                    toolResults={[{ result: toolResult.result, pendingAction: toolResult.pendingAction }, ...toolResults]}
                    onToolConfirm={onToolConfirm}
                    onToolCancel={onToolCancel}
                    loading={false}
                  />
                </div>
              </div>
            );
          }
        }

        // AI 消息
        if (isAiLike) {
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
