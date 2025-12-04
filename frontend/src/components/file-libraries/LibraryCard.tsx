import { HardDrive, Trash2 } from "lucide-react";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

// 格式化字节数为可读字符串
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "无限制";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

interface LibraryCardProps {
  library: FileLibrary;
  onDelete: (id: number) => void;
  loading?: boolean;
}

export function LibraryCard({ library, onDelete, loading }: LibraryCardProps) {
  return (
    <GlassCard 
      variant="lite" 
      className="flex items-center gap-3 p-3 transition-all duration-200 hover:border-primary/20"
    >
      {/* 左侧图标 */}
      <div className={cn("shrink-0 p-2 rounded-lg bg-primary/10 text-primary", DS.glass.lite)}>
        <HardDrive className="h-4 w-4" />
      </div>

      {/* 中间信息 */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <h3 className={cn("text-sm font-medium truncate", DS.text.heading)}>
            {library.display_name || "未命名"}
          </h3>
          {!library.is_enabled && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              已禁用
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate font-mono" title={library.root_path}>
          {library.root_path}
        </p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>容量: {formatBytes(library.capacity_limit_bytes)}</span>
          {library.last_scanned_at && (
            <span className="hidden sm:inline">
              扫描: {new Date(library.last_scanned_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* 右侧删除按钮 */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onDelete(library.id)}
        disabled={loading}
        className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title="删除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </GlassCard>
  );
}
