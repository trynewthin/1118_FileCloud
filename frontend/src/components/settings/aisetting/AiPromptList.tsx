import type { AiChatPrompt } from "@/lib/api/aiConfig";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/button/GlassButton";
import { Pencil, FileText, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

interface AiPromptListProps {
  prompts: AiChatPrompt[];
  onEdit: (prompt: AiChatPrompt) => void;
  onSetDefault: (id: number) => void;
}

export function AiPromptList({ prompts, onEdit, onSetDefault }: AiPromptListProps) {
  if (prompts.length === 0) {
    return (
      <GlassCard variant="ghost" className="flex items-center justify-center py-8 border-dashed">
        <span className={DS.text.caption}>暂无提示词，请先创建</span>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      {prompts.map((p) => (
        <GlassCard key={p.id} variant="lite" className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                p.is_default ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
                DS.glass.lite
              )}>
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("truncate", DS.text.heading)}>{p.title}</span>
                  {p.is_default && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-0">默认</Badge>
                  )}
                </div>
                {p.scope && (
                  <div className={cn("truncate", DS.text.caption)}>作用域：{p.scope}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!p.is_default && (
                <GlassButton
                  size="icon"
                  glassVariant="ghost"
                  className="h-8 w-8"
                  aria-label="设为默认"
                  onClick={() => onSetDefault(p.id)}
                >
                  <Star className="h-4 w-4 text-muted-foreground" />
                </GlassButton>
              )}
              <GlassButton
                size="icon"
                glassVariant="ghost"
                className="h-8 w-8"
                aria-label="编辑提示词"
                onClick={() => onEdit(p)}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
