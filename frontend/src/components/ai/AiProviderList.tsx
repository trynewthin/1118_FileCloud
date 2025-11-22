import type { AiProvider } from "@/lib/api/aiConfig";
import { Card } from "@/components/ui/card";
import { GlassButton } from "@/components/common/GlassButton";
import { Pencil } from "lucide-react";

interface AiProviderListProps {
  providers: AiProvider[];
  onEdit: (provider: AiProvider) => void;
}

export function AiProviderList({ providers, onEdit }: AiProviderListProps) {
  if (providers.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无供应商，请先创建。</div>;
  }

  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <Card key={p.id} className="px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 text-sm min-w-0">
              <div className="font-medium truncate">{p.name}</div>
            </div>
            <div className="flex items-center ml-3 shrink-0">
              <GlassButton
                size="icon"
                glassVariant="lite"
                aria-label="编辑供应商"
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
