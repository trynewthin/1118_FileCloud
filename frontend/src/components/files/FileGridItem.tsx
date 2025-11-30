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

interface FileGridItemProps {
  entry: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
}

const THUMBNAIL_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "mkv", "avi"]);

export function FileGridItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onAction,
}: FileGridItemProps) {
  const isDir = entry.is_directory;
  const ext = entry.extension?.toLowerCase() || "";
  const hasThumbnail = !isDir && THUMBNAIL_EXTS.has(ext);
  const [thumbnailError, setThumbnailError] = useState(false);
  // 直接从 localStorage 读取持久化 token，避免初始渲染时内存 token 为空导致 401
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
        "group relative flex flex-col items-center justify-between p-4 text-center cursor-pointer transition-all duration-300 border border-white/10",
        selected && "border-primary/60 ring-2 ring-primary/30"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* 顶部右上角的操作菜单：悬浮在卡片之上，不再覆盖预览区域 */}
      <div className="absolute top-2 right-2 z-20">
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
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 w-full">
        {/* 统一的缩略图框架：固定比例 + 边框 */}
        <div className="w-full max-h-32 aspect-4/3 rounded-xl bg-background/40 border border-white/10 overflow-hidden flex items-center justify-center shadow-sm">
          {hasThumbnail && !thumbnailError ? (
            <img
              src={thumbnailUrl}
              alt={entry.original_name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={() => setThumbnailError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center text-primary">
              {isDir ? (
                <Folder className="h-10 w-10" />
              ) : ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? (
                <ImageIcon className="h-10 w-10" />
              ) : ["mp4", "webm", "mov", "avi", "mkv"].includes(ext) ? (
                <Film className="h-10 w-10" />
              ) : (
                <File className="h-10 w-10" />
              )}
            </div>
          )}
        </div>

        <div className="w-full mt-2 space-y-1 text-left">
          <p className="truncate text-sm font-medium leading-none" title={entry.original_name}>
            {entry.original_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDir ? "文件夹" : formatSize(entry.size_bytes)}
          </p>
        </div>
      </div>
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
