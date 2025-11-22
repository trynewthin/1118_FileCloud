import type { AiChatPrompt } from "@/lib/api/aiConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GlassButton } from "@/components/common/GlassButton";
import { Pencil } from "lucide-react";

interface AiPromptListProps {
  prompts: AiChatPrompt[];
  onEdit: (prompt: AiChatPrompt) => void;
  onSetDefault: (id: number) => void;
}

export function AiPromptList({ prompts, onEdit, onSetDefault }: AiPromptListProps) {
  if (prompts.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无提示词，请先创建。</div>;
  }

  return (
    <div className="space-y-2">
      {prompts.map((p) => (
        <Card key={p.id} className="px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{p.title}</span>
                {p.is_default && <Badge>默认</Badge>}
              </div>
              {p.scope && (
                <div className="text-[11px] text-muted-foreground">
                  作用域：{p.scope}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              {!p.is_default && (
                <Button variant="outline" size="sm" onClick={() => onSetDefault(p.id)}>
                  设为默认
                </Button>
              )}
              <GlassButton
                size="icon"
                glassVariant="lite"
                aria-label="编辑提示词"
                onClick={() => onEdit(p)}
              >
                <Pencil className="h-4 w-4" />
              </GlassButton>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
