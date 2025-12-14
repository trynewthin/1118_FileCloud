import type { AiChatModel, AiProvider } from "@/lib/api/aiConfig";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/button/GlassButton";
import { Badge } from "@/components/ui/badge";
import { Pencil, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

interface AiModelListProps {
  models: AiChatModel[];
  providers: AiProvider[];
  onEdit: (model: AiChatModel) => void;
}

export function AiModelList({ models, providers, onEdit }: AiModelListProps) {
  const providerName = (id: number | null) => {
    if (id == null) return "未绑定";
    const p = providers.find((x) => x.id === id);
    return p ? p.name : `#${id}`;
  };

  if (models.length === 0) {
    return (
      <GlassCard variant="ghost" className="flex items-center justify-center py-8 border-dashed">
        <span className={DS.text.caption}>暂无模型，请先创建</span>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      {models.map((m) => (
        <GlassCard key={m.id} variant="lite" className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                m.is_enabled ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
                DS.glass.lite
              )}>
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("truncate", DS.text.heading)}>{m.display_name}</span>
                  {!m.is_enabled && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">已禁用</Badge>
                  )}
                </div>
                <div className={cn("truncate", DS.text.caption)}>
                  {m.model_name} · {providerName(m.provider_id)}
                </div>
              </div>
            </div>
            <GlassButton
              size="icon"
              glassVariant="ghost"
              className="h-8 w-8"
              aria-label="编辑模型"
              onClick={() => onEdit(m)}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </GlassButton>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
