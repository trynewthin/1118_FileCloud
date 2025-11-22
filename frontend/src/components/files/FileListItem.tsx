import { useState } from "react";
import { File, Folder, MoreVertical, Image as ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/lib/api/files";
import { buildApiUrl } from "@/lib/api/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";

interface FileListItemProps {
  entry: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
}

const THUMBNAIL_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "mkv", "avi"]);

export function FileListItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onAction,
}: FileListItemProps) {
  const isDir = entry.is_directory;
  const ext = entry.extension?.toLowerCase() || "";
  const hasThumbnail = !isDir && THUMBNAIL_EXTS.has(ext);
  const [thumbnailError, setThumbnailError] = useState(false);

  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("filecloud_auth_token")
      : null;

  const thumbnailUrl = hasThumbnail
    ? buildApiUrl(
        token
          ? `/file-content/${entry.id}/thumbnail?token=${encodeURIComponent(token)}`
          : `/file-content/${entry.id}/thumbnail`,
      )
    : undefined;

  return (
    <GlassCard
      variant="lite"
      hoverEffect
      className={cn(
        "group flex items-center justify-between px-4 py-3 cursor-pointer border border-white/10 transition-all duration-300",
        selected && "border-primary/60 ring-2 ring-primary/30"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* 左侧统一缩略图框架 */}
        <div className="h-14 w-20 flex items-center justify-center overflow-hidden rounded-lg bg-background/40 border border-white/10">
          {hasThumbnail && !thumbnailError ? (
            <img
              src={thumbnailUrl}
              alt={entry.original_name}
              className="h-full w-full object-cover"
              onError={() => setThumbnailError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center text-primary">
              {isDir ? (
                <Folder className="h-8 w-8" />
              ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? (
                <ImageIcon className="h-8 w-8" />
              ) : ["mp4", "webm", "mov", "avi", "mkv"].includes(ext) ? (
                <Film className="h-8 w-8" />
              ) : (
                <File className="h-8 w-8" />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={entry.original_name}>
            {entry.original_name}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{isDir ? "文件夹" : formatSize(entry.size_bytes)}</span>
            <span>•</span>
            <span>{new Date(entry.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <GlassButton
            glassVariant="lite"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </GlassButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isDir && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAction?.("download", entry);
              }}
            >
              下载
            </DropdownMenuItem>
          )}
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
    </GlassCard>
  );
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
