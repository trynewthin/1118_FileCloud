import { File, Folder, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/lib/api/files";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface FileGridItemProps {
  entry: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
}

export function FileGridItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onAction,
}: FileGridItemProps) {
  const isDir = entry.is_directory;

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-between rounded-lg border bg-card p-4 text-center transition-colors hover:bg-accent/50",
        selected && "border-primary bg-accent",
        "cursor-pointer"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 w-full">
        <div className={cn("h-12 w-12 flex items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110")}>
          {isDir ? (
            <Folder className="h-6 w-6 fill-current" />
          ) : (
            <File className="h-6 w-6" />
          )}
        </div>
        <div className="w-full space-y-1">
          <p className="truncate text-sm font-medium leading-none" title={entry.original_name}>
            {entry.original_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDir ? "-" : formatSize(entry.size_bytes)}
          </p>
        </div>
      </div>

      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("rename", entry); }}>
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("move", entry); }}>
              移动
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("copy", entry); }}>
              复制
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-600"
              onClick={(e) => { e.stopPropagation(); onAction?.("delete", entry); }}
            >
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
