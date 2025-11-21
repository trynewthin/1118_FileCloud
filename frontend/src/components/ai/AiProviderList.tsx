import type { AiProvider } from "@/lib/api/aiConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AiProviderListProps {
  providers: AiProvider[];
  onEdit: (provider: AiProvider) => void;
  onDelete: (id: number) => void;
}

export function AiProviderList({ providers, onEdit, onDelete }: AiProviderListProps) {
  if (providers.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无供应商，请先创建。</div>;
  }

  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <Card key={p.id} className="flex items-center justify-between px-3 py-2">
          <div className="space-y-0.5 text-sm">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground break-all">{p.base_url}</div>
            <div className="text-xs text-muted-foreground">类型：{p.api_type}</div>
          </div>
          <div className="flex items-center gap-2 ml-3">
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
