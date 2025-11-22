import type { AiChatModel, AiProvider } from "@/lib/api/aiConfig";
import { Card } from "@/components/ui/card";
import { GlassButton } from "@/components/common/GlassButton";
import { Pencil } from "lucide-react";

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
    return <div className="text-sm text-muted-foreground">暂无模型，请先创建。</div>;
  }

  return (
    <div className="space-y-2">
      {models.map((m) => (
        <Card key={m.id} className="px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{m.display_name}</span>
                {!m.is_enabled && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">已禁用</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">模型：{m.model_name}</div>
              <div className="text-xs text-muted-foreground truncate">供应商：{providerName(m.provider_id)}</div>
            </div>
            <div className="flex items-center gap-2 ml-3 shrink-0">
              <GlassButton
                size="icon"
                glassVariant="lite"
                aria-label="编辑模型"
                onClick={() => onEdit(m)}
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
