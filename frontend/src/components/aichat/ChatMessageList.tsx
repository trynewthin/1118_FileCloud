import type { AiChatMessage } from "@/lib/api/aiChat";
import type { LocalAttachment } from "@/lib/types/aiChat";
import { Bot, User, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { GlassCard } from "@/components/common/GlassCard";
import { ToolCallRenderer, type PendingAction } from "./ToolCallRenderer";
import { buildApiUrl } from "@/lib/api/client";
import { getAuthToken } from "@/lib/api/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback, useMemo } from "react";

// 构建上传图片的 URL
const buildUploadImageUrl = (uploadId: number): string => {
  const token = getAuthToken();
  // 使用 token 作为查询参数（因为 img src 不能设置 header）
  return `${buildApiUrl(`/ai/uploads/${uploadId}`)}${token ? `?token=${token}` : ""}`;
};

// 用户消息气泡组件
function UserMessageBubble({ 
  message, 
  localAttachments 
}: { 
  message: AiChatMessage; 
  localAttachments?: LocalAttachment[];
}) {
  // 从 payload 中获取服务器端附件 ID
  const serverAttachmentIds = useMemo(() => {
    const payload = message.payload as { attachmentIds?: number[] } | null;
    return payload?.attachmentIds || [];
  }, [message.payload]);

  // 优先显示本地附件（发送中），否则显示服务器附件
  const hasLocalAttachments = localAttachments && localAttachments.length > 0;
  const hasServerAttachments = serverAttachmentIds.length > 0;

  return (
    <div
      className={cn(
        "relative w-full px-4 py-2.5 text-sm leading-relaxed shadow-md transition-all",
        DS.radius.xl,
        "bg-linear-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-sm",
        "shadow-primary/20"
      )}
    >
      {/* 显示附件图片 */}
      {(hasLocalAttachments || hasServerAttachments) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {hasLocalAttachments
            ? localAttachments!.map(att => (
                <img
                  key={att.id}
                  src={att.previewUrl}
                  alt="附件"
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                />
              ))
            : serverAttachmentIds.map(id => (
                <img
                  key={id}
                  src={buildUploadImageUrl(id)}
                  alt="附件"
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                />
              ))
          }
        </div>
      )}
      {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}
    </div>
  );
}

// AI 消息组件：Markdown 渲染 + 工具调用结果 + 操作按钮
interface AssistantMessageProps {
  content: string;
  toolResults?: Array<{ result: any; pendingAction?: PendingAction }>;
  onToolConfirm?: (action: PendingAction) => void;
  onToolCancel?: (action: PendingAction) => void;
  loading?: boolean;
}

// 需要放在消息下方的工具结果类型（用户交互类）
const BOTTOM_TOOL_TYPES = new Set(["file_display"]);

function AssistantMessage({ 
  content, 
  toolResults = [], 
  onToolConfirm, 
  onToolCancel,
  loading = false,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, [content]);

  const hasContent = content.trim().length > 0;
  
  // 区分工具结果：上方显示（信息类）和下方显示（用户交互类）
  const topToolResults = toolResults.filter(tr => !BOTTOM_TOOL_TYPES.has(tr.result?.type));
  const bottomToolResults = toolResults.filter(tr => BOTTOM_TOOL_TYPES.has(tr.result?.type));
  const hasTopToolResults = topToolResults.length > 0;
  const hasBottomToolResults = bottomToolResults.length > 0;

  return (
    <div className="flex flex-col w-full gap-2">
      {/* 工具调用结果（上方：信息类）- 每个工具单独气泡 */}
      {hasTopToolResults && (
        <div className="flex flex-col gap-2">
          {topToolResults.map((tr, idx) => (
            <GlassCard
              key={`tool-top-${idx}`}
              variant="lite"
              className={cn(
                "px-3 py-2.5 text-sm border-white/10",
                DS.radius.lg,
                "rounded-tl-sm"
              )}
            >
              <ToolCallRenderer
                result={tr.result}
                pendingAction={tr.pendingAction}
                onConfirm={onToolConfirm}
                onCancel={onToolCancel}
              />
            </GlassCard>
          ))}
        </div>
      )}

      {/* 文本内容气泡 */}
      {hasContent && (
        <GlassCard
          variant="lite"
          className={cn(
            "relative px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all",
            DS.radius.xl,
            "rounded-tl-sm border-white/15"
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </GlassCard>
      )}

      {/* 流式加载指示器 */}
      {!hasContent && !hasTopToolResults && !hasBottomToolResults && loading && (
        <GlassCard
          variant="lite"
          className={cn(
            "relative px-4 py-3 shadow-sm",
            DS.radius.xl,
            "rounded-tl-sm border-white/15"
          )}
        >
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </GlassCard>
      )}
      
      {/* 操作按钮区域 */}
      {hasContent && (
        <div className="flex items-center gap-1 ml-2">
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
              "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30",
              copied && "text-green-500"
            )}
            title={copied ? "已复制" : "复制内容"}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      {/* 工具调用结果（下方：用户交互类，如文件展示）- 每个工具单独气泡 */}
      {hasBottomToolResults && (
        <div className="flex flex-col gap-2">
          {bottomToolResults.map((tr, idx) => (
            <GlassCard
              key={`tool-bottom-${idx}`}
              variant="lite"
              className={cn(
                "px-3 py-2.5 text-sm border-white/10",
                DS.radius.lg,
                "rounded-tl-sm"
              )}
            >
              <ToolCallRenderer
                result={tr.result}
                pendingAction={tr.pendingAction}
                onConfirm={onToolConfirm}
                onCancel={onToolCancel}
              />
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

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
          <div className={cn(
            "shrink-0 h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center shadow-sm",
            DS.glass.lite,
            "text-primary border-primary/20"
          )}>
            <Bot className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </div>
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
                  <div className="shrink-0 h-7 w-7 md:h-8 md:w-8 rounded-full flex items-center justify-center bg-muted/30 text-muted-foreground">
                    <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
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
