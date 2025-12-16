import { Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import type { ToolCallResult } from "./types";

export function LibraryListRenderer({ result }: { result: ToolCallResult }) {
  const libraries = result.libraries || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Database className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>
      <div className="space-y-1">
        {libraries.map((lib: { id: number; name: string }) => (
          <GlassCard
            key={lib.id}
            variant="lite"
            className={cn("px-2 py-1.5", cn(DS.radius.xl, "button-rect:rounded-lg"))}
          >
            <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
            <div className="relative z-10 flex items-center gap-2 min-w-0">
              <Database className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm truncate">{lib.name}</span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">ID: {lib.id}</span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
