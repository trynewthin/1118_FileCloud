import { useState } from "react";
import {
  Folder,
  MoreVertical,
  Check,
  Tag,
  Download,
  Pencil,
  Move,
  Copy,
  Trash2,
  CloudOff,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/lib/api/files";
import { buildApiUrl } from "@/lib/api/client";
import {
  THUMBNAIL_EXTS,
  getFileIconGroup,
  FILE_ICON_COMPONENTS,
  FILE_ICON_DEFAULT_COMPONENT,
} from "@/configs/fileTypeIcons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/button/GlassButton";
import { DS } from "@/theme/design-system";

interface FileListItemProps {
  entry: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
  // 批量模式相关
  batchMode?: boolean;
  batchSelected?: boolean;
  onBatchSelect?: (entry: FileEntry, selected: boolean) => void;
  // 融合访问：库离线状态
  libraryOffline?: boolean;
  // 文件库操作回调（仅当 entry._isLibraryEntry 为 true 时使用）
  onLibraryAction?: (action: "config" | "delete" | "reindex", libraryId: number) => void;
}

export function FileListItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onAction,
  batchMode = false,
  batchSelected = false,
  onBatchSelect,
  libraryOffline = false,
  onLibraryAction,
}: FileListItemProps) {
  const isDir = entry.is_directory;
  const isLibrary = entry._isLibraryEntry === true;
  const isVirtualTags = entry._virtualType === "tags";
  const ext = entry.extension?.toLowerCase() || "";
  const hasThumbnail = !isDir && !isLibrary && THUMBNAIL_EXTS.has(ext);
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
      hoverEffect={!libraryOffline}
      className={cn(
        "group flex items-center justify-between px-4 py-3 border border-white/10 transition-all duration-300",
        selected && "border-primary/60 ring-2 ring-primary/30",
        libraryOffline 
          ? "opacity-50 cursor-not-allowed" 
          : "cursor-pointer"
      )}
      onClick={libraryOffline ? undefined : onClick}
      onDoubleClick={libraryOffline ? undefined : onDoubleClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* 离线标识 */}
        {libraryOffline && (
          <div className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0" title="文件库离线">
            <CloudOff className="h-3.5 w-3.5 text-orange-500" />
          </div>
        )}
        {/* 左侧选择框：批量模式时显示 */}
        {batchMode && !libraryOffline && (
          <button
            type="button"
            className={cn(
              "h-5 w-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
              batchSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background/80 border-muted-foreground/40 hover:border-primary/60"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onBatchSelect?.(entry, !batchSelected);
            }}
          >
            {batchSelected && <Check className="h-3 w-3" />}
          </button>
        )}

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
              {isVirtualTags ? (
                <Tag className="h-8 w-8" />
              ) : isLibrary ? (
                <HardDrive className="h-8 w-8" />
              ) : isDir ? (
                <Folder className="h-8 w-8" />
              ) : (() => {
                const group = getFileIconGroup(ext);
                const Icon = group ? FILE_ICON_COMPONENTS[group] : FILE_ICON_DEFAULT_COMPONENT;
                return <Icon className="h-8 w-8" />;
              })()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground" title={entry.original_name}>
            {entry.original_name}
          </p>
          <div className="flex items-center gap-2 text-xs font-normal text-foreground/70">
            <span>{isVirtualTags ? "标签浏览" : isLibrary ? "文件库" : isDir ? "文件夹" : formatSize(entry.size_bytes)}</span>
            {!isVirtualTags && (
              <>
                <span>•</span>
                <span>{new Date(entry.updated_at).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 操作菜单 */}
      {!isVirtualTags && (
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
          <DropdownMenuContent
            align="end"
            className={cn("min-w-[160px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
          >
            {isLibrary ? (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLibraryAction?.("config", entry.library_id); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  配置
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onLibraryAction?.("reindex", entry.library_id); }}>
                  <Tag className="h-4 w-4 mr-2" />
                  重建索引
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={(e) => { e.stopPropagation(); onLibraryAction?.("delete", entry.library_id); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {!isDir && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction?.("download", entry);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下载
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("rename", entry); }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  重命名
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("move", entry); }}>
                  <Move className="h-4 w-4 mr-2" />
                  移动
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("copy", entry); }}>
                  <Copy className="h-4 w-4 mr-2" />
                  复制
                </DropdownMenuItem>
                {!isDir && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction?.("tag", entry); }}>
                    <Tag className="h-4 w-4 mr-2" />
                    标签
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={(e) => { e.stopPropagation(); onAction?.("delete", entry); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
