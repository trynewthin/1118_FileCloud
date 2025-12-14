import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Check,
  CloudOff,
  Copy,
  Download,
  MoreVertical,
  Move,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/lib/api/files";
import { buildApiUrl } from "@/lib/api/client";
import { THUMBNAIL_EXTS } from "@/configs/fileTypeIcons";
import { getFileIconGroup, type FileIconGroupKey } from "@/configs/fileTypeIcons";
import {
  getSkeuoFileIconComponent,
  SKEUO_FILE_STYLE_TOKENS,
  type SkeuoFileTypeKey,
} from "@/configs/skeuoFileDesign";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { DS } from "@/theme/design-system";

export interface SkeuoFileItemProps {
  // 兼容用法（测试/静态渲染）
  name?: string;
  subtitle?: string;
  icon?: ReactNode;
  thumbnailUrl?: string;
  ext?: string;
  fileType?: FileIconGroupKey | "default";

  // 业务用法（文件浏览网格）
  entry?: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
  batchMode?: boolean;
  batchSelected?: boolean;
  onBatchSelect?: (entry: FileEntry, selected: boolean) => void;
  libraryOffline?: boolean;
}

export function SkeuoFileItem({
  name,
  subtitle,
  selected,
  onClick,
  onDoubleClick,
  onAction,
  batchMode = false,
  batchSelected = false,
  onBatchSelect,
  libraryOffline = false,
  icon,
  thumbnailUrl,
  ext,
  fileType,
  entry,
}: SkeuoFileItemProps) {
  const realName = entry?.original_name ?? name ?? "";
  const realExt = (entry?.extension ?? ext ?? "").toLowerCase().replace(/^\./, "");
  const isFile = entry ? !entry.is_directory && entry._isLibraryEntry !== true : true;

  const computedThumbnailUrl = useMemo(() => {
    if (!entry) return undefined;
    const isDir = entry.is_directory;
    const isLibrary = entry._isLibraryEntry === true;
    const hasThumbnail = !isDir && !isLibrary && THUMBNAIL_EXTS.has(realExt);
    if (!hasThumbnail) return undefined;
    const token =
      typeof window !== "undefined" ? window.localStorage.getItem("filecloud_auth_token") : null;
    return buildApiUrl(
      token
        ? `/file-content/${entry.id}/thumbnail?token=${encodeURIComponent(token)}`
        : `/file-content/${entry.id}/thumbnail`,
    );
  }, [entry, realExt]);

  const [thumbnailError, setThumbnailError] = useState(false);
  const effectiveThumbnailUrl = thumbnailUrl ?? (thumbnailError ? undefined : computedThumbnailUrl);

  const groupFromExt = realExt ? getFileIconGroup(realExt) : undefined;
  const fileTypeKey: SkeuoFileTypeKey = (fileType ?? groupFromExt ?? "default") as SkeuoFileTypeKey;
  const tokens = SKEUO_FILE_STYLE_TOKENS[fileTypeKey];
  const IconComponent = getSkeuoFileIconComponent(fileTypeKey);

  const disabled = libraryOffline;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      className={cn(
        "relative inline-flex w-20 flex-col items-center place-self-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      {libraryOffline && (
        <div className="absolute top-2 left-2 z-20">
          <div
            className="h-6 w-6 rounded-full bg-orange-500/20 flex items-center justify-center"
            title="文件库离线"
          >
            <CloudOff className="h-3.5 w-3.5 text-orange-500" />
          </div>
        </div>
      )}

      {batchMode && entry && (
        <div className="absolute top-2 left-2 z-20">
          <button
            type="button"
            className={cn(
              "h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
              batchSelected
                ? "bg-primary border-primary text-primary-foreground"
                : "bg-background/80 border-muted-foreground/40 hover:border-primary/60",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onBatchSelect?.(entry, !batchSelected);
            }}
          >
            {batchSelected && <Check className="h-3 w-3" />}
          </button>
        </div>
      )}

      {entry && (
        <div className="absolute top-1 right-1 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <GlassIconButton
                glassVariant="ghost"
                className="group/menu h-7 w-7 bg-transparent shadow-none hover:shadow-none hover:scale-100 active:scale-100 transition-none border-none ring-0 hover:ring-0 focus:ring-0 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 focus-visible:border-0 focus-visible:border-transparent"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4 transition-transform duration-200 group-hover/menu:rotate-90" />
              </GlassIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn("min-w-[160px] p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
            >
              {isFile && (
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

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.("rename", entry);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.("move", entry);
                }}
              >
                <Move className="h-4 w-4 mr-2" />
                移动
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.("copy", entry);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                复制
              </DropdownMenuItem>

              {isFile && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.("tag", entry);
                  }}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  标签
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.("delete", entry);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div
        className={cn(
          disabled ? "" : "group",
          "relative flex w-full flex-col items-center justify-center overflow-visible",
          disabled ? "opacity-60" : "",
        )}
      >
        <div
          style={{
            "--file-bg-from": tokens.bgFrom,
            "--file-bg-mid": tokens.bgMid,
            "--file-bg-to": tokens.bgTo,
            "--file-icon": tokens.iconColor,
            "--file-highlight": tokens.highlight,
          } as CSSProperties}
          className={cn(
            "relative h-24 w-20 origin-bottom perspective-[1500px]",
            selected && "ring-2 ring-primary/50 rounded-2xl",
          )}
        >
          <div
            className={cn(
              "absolute inset-[3px] rounded-2xl bg-zinc-300",
              "shadow-[0_10px_18px_rgba(0,0,0,0.12)]",
              !disabled && "transition-transform duration-300 ease group-hover:transform-[rotateX(-18deg)]",
            )}
          />
          <div
            className={cn(
              "absolute inset-[2px] rounded-2xl bg-zinc-200",
              "shadow-[0_10px_18px_rgba(0,0,0,0.10)]",
              !disabled && "transition-transform duration-300 ease group-hover:transform-[rotateX(-26deg)]",
            )}
          />

          <div
            className={cn(
              "relative h-full w-full overflow-hidden rounded-2xl",
              "bg-linear-to-b from-(--file-bg-from) via-(--file-bg-mid) to-(--file-bg-to)",
              "shadow-[0_14px_26px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.75)]",
              "border border-black/5",
              !disabled && "transition-transform duration-300 ease group-hover:-translate-y-px",
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,var(--file-highlight),transparent_55%)]" />

            <div className="relative flex h-full w-full items-center justify-center">
              {effectiveThumbnailUrl ? (
                <img
                  src={effectiveThumbnailUrl}
                  alt={realName}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setThumbnailError(true)}
                />
              ) : (
                <div className="text-(--file-icon) [&>svg]:h-9 [&>svg]:w-9">
                  {icon ?? <IconComponent className="h-9 w-9" />}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full pt-1.5 text-center min-w-0 overflow-hidden">
          <div className="w-full truncate text-xs font-medium text-foreground" title={realName}>
            {realName}
          </div>
          <div className="w-full truncate text-[11px] font-normal text-muted-foreground" title={subtitle}>
            {subtitle}
          </div>
        </div>
      </div>
    </button>
  );
}
