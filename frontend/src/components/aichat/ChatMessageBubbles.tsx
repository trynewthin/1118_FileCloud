import type { AiChatMessage } from "@/lib/api/aiChat";
import type { LocalAttachment } from "@/lib/types/aiChat";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { ToolCallRenderer, type PendingAction } from "./ToolCallRenderer";
import { buildApiUrl } from "@/lib/api/client";
import { getAuthToken } from "@/lib/api/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback, useMemo } from "react";

const bubbleRadiusXl = cn("rounded-3xl", "button-rect:rounded-xl");
const bubbleRadiusLg = cn(DS.radius.xl, "button-rect:rounded-lg");

// 构建上传图片的 URL
const buildUploadImageUrl = (uploadId: number): string => {
  const token = getAuthToken();
  // 使用 token 作为查询参数（因为 img src 不能设置 header）
  return `${buildApiUrl(`/ai/files/${uploadId}/content`)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
};

// 需要放在消息下方的工具结果类型（用户交互类）
export const BOTTOM_TOOL_TYPES = new Set(["file_display"]);

// 用户消息气泡组件
export function UserMessageBubble({
  message,
  localAttachments,
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
    <GlassCard
      variant="strong"
      className={cn(
        "w-full px-4 py-2.5 text-sm leading-relaxed shadow-md transition-all",
        bubbleRadiusXl,
        "bg-linear-to-br from-primary to-primary/80 text-primary-foreground rounded-tr-sm button-rect:rounded-tr-md",
        "shadow-primary/20"
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-black/20 pointer-events-none" />
      {/* 显示附件图片 */}
      {(hasLocalAttachments || hasServerAttachments) && (
        <div className="relative z-10 flex flex-wrap gap-2 mb-2">
          {hasLocalAttachments
            ? localAttachments!.map((att) => (
                <img
                  key={att.id}
                  src={att.previewUrl}
                  alt="附件"
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                />
              ))
            : serverAttachmentIds.map((id) => (
                <img
                  key={id}
                  src={buildUploadImageUrl(id)}
                  alt="附件"
                  className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                />
              ))}
        </div>
      )}
      {message.content && (
        <div className="relative z-10 whitespace-pre-wrap wrap-anywhere">
          {message.content}
        </div>
      )}
    </GlassCard>
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

export function AssistantMessage({
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

  // 区分工具结果：正文后显示（信息类）和末尾显示（用户交互类）
  const inlineToolResults = toolResults.filter(
    (tr) => !BOTTOM_TOOL_TYPES.has(tr.result?.type) && !tr.pendingAction,
  );
  const bottomToolResults = toolResults.filter(
    (tr) => BOTTOM_TOOL_TYPES.has(tr.result?.type) || !!tr.pendingAction,
  );
  const hasInlineToolResults = inlineToolResults.length > 0;
  const hasBottomToolResults = bottomToolResults.length > 0;

  return (
    <div className="flex flex-col w-full gap-2 min-w-0">
      {/* 主气泡：正文 + 信息类工具结果（内联，不分多个气泡） */}
      {(hasContent || hasInlineToolResults) && (
        <GlassCard
          variant="lite"
          className={cn(
            "relative px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all min-w-0",
            bubbleRadiusXl,
            "rounded-tl-sm button-rect:rounded-tl-md border-white/15"
          )}
        >
          <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
          <div
            className={cn(
              "relative z-10 min-w-0 wrap-anywhere",
              "prose prose-sm dark:prose-invert",
              "prose-headings:font-semibold prose-headings:text-foreground",
              "prose-p:leading-relaxed prose-p:text-foreground",
              "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
              "prose-strong:text-foreground",
              "prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
              "prose-code:before:content-none prose-code:after:content-none",
              "[&_pre_code]:bg-transparent [&_pre_code]:text-slate-50 dark:[&_pre_code]:text-slate-100 [&_pre_code]:p-0"
            )}
          >
            {hasContent && <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>}

            {hasInlineToolResults && (
              <div className={cn(hasContent ? "mt-3 pt-3 border-t border-white/10" : "")}>
                <div className={cn(
                  "px-3 py-2.5",
                  "pb-3",
                  cn(DS.radius.xl, "button-rect:rounded-lg"),
                  "bg-white/5 dark:bg-black/20",
                  "min-w-0"
                )}>
                  <div className="flex flex-col gap-2 min-w-0">
                    {inlineToolResults.map((tr, idx) => (
                      <div key={`tool-inline-${idx}`} className="min-w-0 wrap-anywhere">
                        <ToolCallRenderer
                          result={tr.result}
                          pendingAction={tr.pendingAction}
                          onConfirm={onToolConfirm}
                          onCancel={onToolCancel}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* 流式加载指示器 */}
      {!hasContent && !hasInlineToolResults && !hasBottomToolResults && loading && (
        <GlassCard
          variant="lite"
          className={cn(
            "relative px-4 py-3 shadow-sm min-w-0",
            bubbleRadiusXl,
            "rounded-tl-sm button-rect:rounded-tl-md border-white/15"
          )}
        >
          <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
          <div className="relative z-10 flex gap-1">
            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </GlassCard>
      )}

      {/* 操作按钮区域 */}
      {hasContent && (
        <div className="flex items-center gap-1 ml-2">
          <GlassIconButton
            type="button"
            glassVariant="lite"
            onClick={handleCopy}
            className={cn(
              "h-6! w-6!",
              cn(DS.radius.full, "button-rect:rounded-md"),
              copied && "border-primary/30 ring-2 ring-primary/15"
            )}
            title={copied ? "已复制" : "复制内容"}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </GlassIconButton>
        </div>
      )}

      {/* 工具调用结果（下方：用户交互类，如文件展示）- 每个工具单独气泡 */}
      {hasBottomToolResults && (
        <div className="flex flex-col gap-2 min-w-0">
          {bottomToolResults.map((tr, idx) => (
            <GlassCard
              key={`tool-bottom-${idx}`}
              variant="lite"
              className={cn(
                "px-3 py-2.5 text-sm border-white/10 min-w-0",
                bubbleRadiusLg,
                "rounded-tl-sm button-rect:rounded-tl-md"
              )}
            >
              <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
              <div className="relative z-10 min-w-0 wrap-anywhere">
                <ToolCallRenderer
                  result={tr.result}
                  pendingAction={tr.pendingAction}
                  onConfirm={onToolConfirm}
                  onCancel={onToolCancel}
                />
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
