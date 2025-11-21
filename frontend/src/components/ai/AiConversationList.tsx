import type { AiChatConversation } from "@/lib/api/aiChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AiConversationListProps {
  conversations: AiChatConversation[];
  currentId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNewConversation: () => void;
}

export function AiConversationList({
  conversations,
  currentId,
  loading,
  onSelect,
  onNewConversation,
}: AiConversationListProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索会话标题..."
          className="h-8 text-xs"
          // 简单占位，后续可加真正搜索逻辑
          readOnly
        />
        <Button size="sm" onClick={onNewConversation}>
          新会话
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto rounded border bg-card">
        {loading && conversations.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">加载中...</div>
        ) : conversations.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">暂无会话</div>
        ) : (
          <div className="py-1 text-sm">
            {conversations.map((c) => {
              const active = c.id === currentId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-accent ${
                    active ? "bg-accent text-accent-foreground" : ""
                  }`}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="truncate">{c.title || `会话 #${c.id}`}</span>
                  {c.is_archived && (
                    <span className="ml-2 text-[10px] text-muted-foreground">已归档</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
