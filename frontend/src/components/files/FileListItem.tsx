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

interface FileListItemProps {
  entry: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
}

export function FileListItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onAction,
}: FileListItemProps) {
  const isDir = entry.is_directory;

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-md border bg-card px-4 py-3 transition-colors hover:bg-accent/50",
        selected && "border-primary bg-accent",
        "cursor-pointer"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary")}>
          {isDir ? (
            <Folder className="h-5 w-5 fill-current" />
          ) : (
            <File className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={entry.original_name}>
            {entry.original_name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{isDir ? "-" : formatSize(entry.size_bytes)}</span>
            <span>•</span>
            <span>{new Date(entry.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
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
  );
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
