import { HardDrive, Trash2 } from "lucide-react";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

// 格式化字节数为可读字符串
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "未设置";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
}

interface LibraryCardProps {
  library: FileLibrary;
  onDelete: (id: number) => void;
  loading?: boolean;
}

export function LibraryCard({ library, onDelete, loading }: LibraryCardProps) {
  return (
    <GlassCard variant="strong" className="flex flex-col justify-between p-5 gap-4 transition-all duration-300 hover:border-primary/20">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-primary/10 text-primary", DS.glass.lite)}>
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <h3 className={cn("text-base", DS.text.heading)}>{library.display_name || "未命名文件库"}</h3>
              <Badge variant={library.is_enabled ? "default" : "secondary"} className="h-5 text-[10px] px-1.5">
                {library.is_enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="px-1">
           <p className={cn("truncate font-mono bg-muted/30 p-1.5 rounded text-xs", DS.text.caption)} title={library.root_path}>
            {library.root_path}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2 text-sm px-1">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-xs">容量限制</span>
            <span className="font-medium font-mono">{formatBytes(library.capacity_limit_bytes)}</span>
          </div>
          <div className="flex justify-between items-center">
             <span className="text-muted-foreground text-xs">最后扫描</span>
             <span className="text-xs">{library.last_scanned_at ? new Date(library.last_scanned_at).toLocaleString() : "从未"}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
          <GlassButton
            variant="ghost"
            glassVariant="ghost"
            size="sm"
            onClick={() => onDelete(library.id)}
            disabled={loading}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            删除
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}
