import type { AiChatMessage } from "@/lib/api/aiChat";
import type { LocalAttachment } from "@/lib/types/aiChat";
import { Bot, User, Copy, Check, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";
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
        "relative max-w-[85%] md:max-w-[75%] px-4 py-2.5 text-sm leading-relaxed shadow-md transition-all",
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

// AI 消息组件：Markdown 渲染 + 操作按钮
function AssistantMessage({ content }: { content: string }) {
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

  return (
    <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
      <GlassCard
        variant="lite"
        className={cn(
          "relative px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all",
          DS.radius.xl,
          "rounded-tl-sm border-white/15"
        )}
      >
        {/* Markdown 渲染 */}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-pre:my-2 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </GlassCard>
      
      {/* 操作按钮区域 */}
      <div className="flex items-center gap-1 mt-1 ml-2">
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
      
      {messages.map((m) => {
        const isAssistant = m.role === "assistant";
        const isSystem = m.role === "system";
        const isUser = m.role === "user";
        const isTool = m.role === "tool";

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

        // 工具调用结果消息
        if (isTool && m.payload) {
          const toolResult = m.payload as { result?: any; pendingAction?: PendingAction };
          if (toolResult.result) {
            return (
              <div key={m.id} className="flex w-full justify-start gap-3">
                <div className={cn(
                  "shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm mt-1",
                  DS.glass.lite,
                  "text-info border-info/20"
                )}>
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="max-w-[85%] md:max-w-[75%]">
                  <ToolCallRenderer
                    result={toolResult.result}
                    pendingAction={toolResult.pendingAction}
                    onConfirm={onToolConfirm}
                    onCancel={onToolCancel}
                  />
                </div>
              </div>
            );
          }
        }

        return (
          <div
            key={m.id}
            className={cn(
              "flex w-full gap-3",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            {isAssistant && (
              <div className={cn(
                "shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm mt-1",
                DS.glass.lite,
                "text-primary border-primary/20"
              )}>
                <Bot className="h-4 w-4" />
              </div>
            )}

            {isUser ? (
              // 用户消息：主题色渐变气泡
              <UserMessageBubble
                message={m}
                localAttachments={localAttachments?.get(m.id)}
              />
            ) : (
              // AI 消息：玻璃拟态气泡 + Markdown 渲染
              <AssistantMessage content={m.content || ""} />
            )}

            {isUser && (
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1 bg-muted/30 text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
      
      {/* Loading Indicator at bottom */}
      {loading && messages.length > 0 && (
        <div className="flex w-full justify-start gap-3">
           <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-1">
              <Bot className="h-4 w-4" />
           </div>
           <div className={cn("px-4 py-3 bg-background/40 backdrop-blur-md border border-white/5 rounded-2xl rounded-tl-sm")}>
             <div className="flex gap-1">
               <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
