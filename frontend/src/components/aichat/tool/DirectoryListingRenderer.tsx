import { useState } from "react";
import { FolderOpen, Folder, File, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import type { ToolCallResult } from "./types";
import { formatSize } from "./format";

export function DirectoryListingRenderer({ result }: { result: ToolCallResult }) {
  const entries = result.entries || [];
  const [expanded, setExpanded] = useState(entries.length <= 10);

  const displayEntries = expanded ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5 && !expanded;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <FolderOpen className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {displayEntries.map(
          (entry: {
            id: string;
            name: string;
            isDirectory: boolean;
            size: number;
            extension: string | null;
          }) => (
            <GlassCard
              key={entry.id}
              variant="lite"
              className={cn("px-2 py-1.5", cn(DS.radius.xl, "button-rect:rounded-lg"))}
            >
              <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
              <div className="relative z-10 flex items-center gap-2 min-w-0 group">
                {entry.isDirectory ? (
                  <Folder className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <File className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{entry.name}</span>
                {!entry.isDirectory && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatSize(entry.size)}
                  </span>
                )}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </GlassCard>
          ),
        )}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full text-center text-xs text-primary hover:underline py-1"
          >
            显示全部 {entries.length} 项
          </button>
        )}
      </div>
    </div>
  );
}
