import type { AiChatMessage } from "@/lib/api/aiChat";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ChatMessageListProps {
  messages: AiChatMessage[];
  loading: boolean;
  onReloadConversations?: () => void;
  reloadingConversations?: boolean;
}

export function ChatMessageList({
  messages,
  loading,
  onReloadConversations,
  reloadingConversations,
}: ChatMessageListProps) {
  return (
    <div className="flex h-full flex-col rounded border bg-card p-3 text-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {onReloadConversations && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => onReloadConversations()}
              disabled={reloadingConversations}
            >
              <RefreshCw
                className={`h-4 w-4 ${reloadingConversations ? "animate-spin" : ""}`}
              />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
        {loading && messages.length === 0 && (
          <div className="py-2 text-center text-xs text-muted-foreground">加载中...</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="py-2 text-center text-xs text-muted-foreground">暂无消息，发送一条试试。</div>
        )}
        {messages.map((m) => {
        const isAssistant = m.role === "assistant";
        const isSystem = m.role === "system";
        return (
          <div
            key={m.id}
            className={`flex w-full ${isAssistant || isSystem ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                isSystem
                  ? "bg-muted text-muted-foreground"
                  : isAssistant
                    ? "bg-accent text-accent-foreground"
                    : "bg-primary text-primary-foreground"
              }`}
            >
              {m.content || (isSystem ? "(系统消息)" : "")}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
