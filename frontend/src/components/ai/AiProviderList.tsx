import type { AiProvider } from "@/lib/api/aiConfig";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import { Pencil, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

interface AiProviderListProps {
  providers: AiProvider[];
  onEdit: (provider: AiProvider) => void;
}

export function AiProviderList({ providers, onEdit }: AiProviderListProps) {
  if (providers.length === 0) {
    return (
      <GlassCard variant="ghost" className="flex items-center justify-center py-8 border-dashed">
        <span className={DS.text.caption}>暂无供应商，请先创建</span>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <GlassCard key={p.id} variant="lite" className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={cn("p-2 rounded-lg bg-primary/10 text-primary shrink-0", DS.glass.lite)}>
                <Server className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("truncate", DS.text.heading)}>{p.name}</div>
                <div className={cn("truncate", DS.text.caption)}>{p.base_url}</div>
              </div>
            </div>
            <GlassButton
              size="icon"
              glassVariant="ghost"
              className="h-8 w-8"
              aria-label="编辑供应商"
              onClick={() => onEdit(p)}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </GlassButton>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
