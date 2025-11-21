import type { AiChatModel, AiProvider } from "@/lib/api/aiConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AiModelListProps {
  models: AiChatModel[];
  providers: AiProvider[];
  onEdit: (model: AiChatModel) => void;
  onDelete: (id: number) => void;
}

export function AiModelList({ models, providers, onEdit, onDelete }: AiModelListProps) {
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
        <Card key={m.id} className="flex items-center justify-between px-3 py-2">
          <div className="space-y-0.5 text-sm">
            <div className="font-medium flex items-center gap-2">
              <span>{m.display_name}</span>
              {!m.is_enabled && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">已禁用</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">模型：{m.model_name}</div>
            <div className="text-xs text-muted-foreground">供应商：{providerName(m.provider_id)}</div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <Button variant="outline" size="sm" onClick={() => onEdit(m)}>
              编辑
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(m.id)}>
              删除
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
