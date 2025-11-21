import type { AiChatConversation } from "@/lib/api/aiChat";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const currentConversation = conversations.find((c) => c.id === currentId) ?? null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
      <div className="flex-1 min-w-0">
        {hasConversations ? (
          <Select
            value={currentConversation ? String(currentConversation.id) : undefined}
            onValueChange={(value) => {
              const id = Number(value);
              if (!Number.isInteger(id)) return;
              onSelect(id);
            }}
            disabled={loading}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder={loading ? "加载会话中..." : "选择会话"} />
            </SelectTrigger>
            <SelectContent>
              {conversations.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                  {c.title || `会话 #${c.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span>{loading ? "加载会话中..." : "暂无会话"}</span>
        )}
      </div>
      <Button size="sm" className="shrink-0" onClick={onNewConversation} disabled={loading}>
        新会话
      </Button>
    </div>
  );
}
