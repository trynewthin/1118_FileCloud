import type { AiChatPrompt } from "@/lib/api/aiConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface AiPromptListProps {
  prompts: AiChatPrompt[];
  onEdit: (prompt: AiChatPrompt) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
}

export function AiPromptList({ prompts, onEdit, onDelete, onSetDefault }: AiPromptListProps) {
  if (prompts.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无提示词，请先创建。</div>;
  }

  return (
    <div className="space-y-2">
      {prompts.map((p) => (
        <Card key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{p.title}</span>
              {p.is_default && <Badge>默认</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {p.content}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            {!p.is_default && (
              <Button variant="outline" size="sm" onClick={() => onSetDefault(p.id)}>
                设为默认
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onEdit(p)}>
              编辑
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(p.id)}>
              删除
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
