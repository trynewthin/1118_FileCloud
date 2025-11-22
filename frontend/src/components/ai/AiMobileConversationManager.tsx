import type { AiChatConversation } from "@/lib/api/aiChat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AiMobileConversationManagerProps {
  conversations: AiChatConversation[];
  currentId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNewConversation: () => void;
}

export function AiMobileConversationManager({
  conversations,
  currentId,
  loading,
  onSelect,
  onNewConversation,
}: AiMobileConversationManagerProps) {
  const hasConversations = conversations.length > 0;

  return (
    <Card className="flex flex-col gap-2 px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">会话列表</span>
        <Button size="sm" className="shrink-0" onClick={onNewConversation} disabled={loading}>
          新会话
        </Button>
      </div>

      {loading && !hasConversations && (
        <div className="py-3 text-center text-[11px] text-muted-foreground">加载中...</div>
      )}
      {!loading && !hasConversations && (
        <div className="py-3 text-center text-[11px] text-muted-foreground">暂无会话</div>
      )}
      {hasConversations && (
        <ScrollArea className="max-h-72 -mx-1">
          <div className="py-1">
            {conversations.map((c) => {
              const active = c.id === currentId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-accent ${
                    active ? "bg-accent text-accent-foreground" : ""
                  }`}
                  onClick={() => onSelect(c.id)}
                >
                  <span className="truncate">
                    {c.title || `会话 #${c.id}`}
                  </span>
                  {c.is_archived && (
                    <span className="ml-2 text-[10px] text-muted-foreground">已归档</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
