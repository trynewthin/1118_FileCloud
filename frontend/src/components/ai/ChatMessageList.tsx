import type { AiChatMessage } from "@/lib/api/aiChat";

interface ChatMessageListProps {
  messages: AiChatMessage[];
  loading: boolean;
}

export function ChatMessageList({ messages, loading }: ChatMessageListProps) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded border bg-card p-3 text-sm">
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
  );
}
