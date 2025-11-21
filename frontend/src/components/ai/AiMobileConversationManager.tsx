import type { AiChatConversation } from "@/lib/api/aiChat";
import type { AiChatModel } from "@/lib/api/aiConfig";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AiMobileConversationManagerProps {
  conversations: AiChatConversation[];
  currentId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNewConversation: () => void;
  models: AiChatModel[];
  onChangeModel: (modelId: number) => void;
}

export function AiMobileConversationManager({
  conversations,
  currentId,
  loading,
  onSelect,
  onNewConversation,
  models,
  onChangeModel,
}: AiMobileConversationManagerProps) {
  const hasConversations = conversations.length > 0;
  const currentConversation = conversations.find((c) => c.id === currentId) ?? null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
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

      {currentConversation && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="shrink-0">模型：</span>
          <Select
            value={String(currentConversation.model_id)}
            onValueChange={(value) => {
              const modelId = Number(value);
              if (!Number.isInteger(modelId) || modelId <= 0) return;
              onChangeModel(modelId);
            }}
          >
            <SelectTrigger className="h-8 flex-1 min-w-0 text-xs">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem
                  key={m.id}
                  value={String(m.id)}
                  disabled={!m.is_enabled}
                  className="text-xs"
                >
                  {m.display_name}
                  {!m.is_enabled ? "（已禁用）" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
