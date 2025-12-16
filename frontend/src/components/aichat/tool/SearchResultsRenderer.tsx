import { useState } from "react";
import { Search, ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import type { ToolCallResult } from "./types";
import { formatSize } from "./format";
import {
  FILE_ICON_COMPONENTS,
  FILE_ICON_DEFAULT_COMPONENT,
  getFileIconGroup,
} from "@/configs/fileTypeIcons";

export function SearchResultsRenderer({ result }: { result: ToolCallResult }) {
  const results = result.results || [];
  const [expanded, setExpanded] = useState(results.length <= 10);

  const displayResults = expanded ? results : results.slice(0, 5);
  const hasMore = results.length > 5 && !expanded;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Search className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>
      {results.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">未找到匹配的文件或目录</div>
      ) : (
        <div className={cn(
          "space-y-1 max-h-[300px] overflow-y-auto",
          "px-1 py-1",
          "pr-2"
        )}>
          {displayResults.map(
            (item: {
              id: string;
              name: string;
              path: string;
              isDirectory: boolean;
              size: number;
              extension: string | null;
            }) => (
              <GlassCard
                key={item.id}
                variant="lite"
                className={cn("px-2 py-1.5", cn(DS.radius.xl, "button-rect:rounded-lg"))}
              >
                <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
                <div className="relative z-10 flex items-center gap-2 min-w-0 group">
                  {item.isDirectory ? (
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                  ) : (() => {
                      const group = getFileIconGroup(item.extension || "");
                      const Icon = group ? FILE_ICON_COMPONENTS[group] : FILE_ICON_DEFAULT_COMPONENT;
                      return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
                    })()}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.path}</div>
                  </div>
                  {!item.isDirectory && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatSize(item.size)}
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
              显示全部 {results.length} 项
            </button>
          )}
        </div>
      )}
    </div>
  );
}
