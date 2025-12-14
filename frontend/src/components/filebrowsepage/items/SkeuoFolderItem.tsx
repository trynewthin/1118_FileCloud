import type { CSSProperties, ReactNode } from "react";
import {
  Check,
  CloudOff,
  Copy,
  MoreVertical,
  Move,
  Pencil,
  Tag,
  Trash2,
  HardDrive,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileEntry } from "@/lib/api/files";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { DS } from "@/theme/design-system";

export interface SkeuoFolderColors {
  back: string;
  tab: string;
  tabNotch: string;
  frontFrom: string;
  frontTo: string;
  frontTop: string;
  innerHighlight: string;
  innerShadow: string;
}

export interface SkeuoFolderItemProps {
  // 兼容用法（测试/静态渲染）
  name?: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;

  // 业务用法（文件浏览网格）
  entry?: FileEntry;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
  batchMode?: boolean;
  batchSelected?: boolean;
  onBatchSelect?: (entry: FileEntry, selected: boolean) => void;
  libraryOffline?: boolean;
  onLibraryAction?: (action: "config" | "delete" | "reindex", libraryId: number) => void;
  folderColor?: Partial<SkeuoFolderColors>;
  frontIcon?: ReactNode;
  scale?: number;
  scaleWithText?: boolean;
}

const DEFAULT_FOLDER_COLORS: SkeuoFolderColors = {
  back: "#d97706",
  tab: "#d97706",
  tabNotch: "#d97706",
  frontFrom: "#f59e0b",
  frontTo: "#fbbf24",
  frontTop: "#fbbf24",
  innerHighlight: "#fbbf24",
  innerShadow: "#d97706",
};

export function SkeuoFolderItem({
  name,
  subtitle,
  selected = false,
  disabled: disabledProp = false,
  onClick,
  folderColor,
  frontIcon,
  scale = 1,
  scaleWithText = true,
  entry,
  onDoubleClick,
  onAction,
  batchMode = false,
  batchSelected = false,
  onBatchSelect,
  libraryOffline = false,
  onLibraryAction,
}: SkeuoFolderItemProps) {
  const isDir = entry ? entry.is_directory : true;
  const isLibrary = entry ? entry._isLibraryEntry === true : false;
  const isVirtualTags = entry ? entry._virtualType === "tags" : false;

  const realName = entry?.original_name ?? name ?? "";
  const realSubtitle =
    entry
      ? isVirtualTags
        ? "标签浏览"
        : isLibrary
          ? "文件库"
          : "文件夹"
      : subtitle;

  const disabled = disabledProp || libraryOffline;

  const colors: SkeuoFolderColors = {
    ...DEFAULT_FOLDER_COLORS,
    ...(folderColor ?? {}),
  };

  const folderStyle = {
    "--folder-back": colors.back,
    "--folder-tab": colors.tab,
    "--folder-tab-notch": colors.tabNotch,
    "--folder-front-from": colors.frontFrom,
    "--folder-front-to": colors.frontTo,
    "--folder-front-top": colors.frontTop,
    "--folder-inner-highlight": colors.innerHighlight,
    "--folder-inner-shadow": colors.innerShadow,
  } as CSSProperties;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      className={cn(
        "inline-flex w-32 flex-col items-center place-self-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <section
        style={folderStyle}
        className={cn(
          disabled ? "" : "group",
          "relative flex h-full w-full flex-col items-center justify-center min-w-0 overflow-visible",
          disabled ? "opacity-60" : "",
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

        {!isVirtualTags && entry && (
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
                {isLibrary ? (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onLibraryAction?.("config", entry.library_id);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      配置
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onLibraryAction?.("reindex", entry.library_id);
                      }}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      重建索引
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLibraryAction?.("delete", entry.library_id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div
          className="origin-top transform-gpu w-full min-w-0"
          style={{ transform: scale === 1 ? undefined : `scale(${scale})` }}
        >
          <div
            className={cn(
              "file relative h-22 w-32 origin-bottom perspective-[1500px] z-50 mx-auto",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              selected && "ring-2 ring-primary/50 rounded-2xl",
            )}
          >
            <div
              className={cn(
                "work-5 w-full h-full origin-top rounded-2xl rounded-tl-none transition-all ease duration-300 relative",
                "bg-(--folder-back)",
                "after:absolute after:content-[''] after:bottom-[99%] after:left-0 after:w-10 after:h-2 after:rounded-t-2xl after:bg-(--folder-tab)",
                "before:absolute before:content-[''] before:-top-[8px] before:left-[34px] before:w-2 before:h-2 before:bg-(--folder-tab-notch) before:[clip-path:polygon(0_35%,0%_100%,50%_100%)]",
                !disabled && "group-hover:shadow-[0_20px_40px_rgba(0,0,0,.2)]",
              )}
            />

            <div
              className={cn(
                "work-4 absolute inset-1 bg-zinc-400 rounded-2xl transition-all ease duration-300 origin-bottom select-none",
                !disabled && "group-hover:transform-[rotateX(-20deg)]",
              )}
            />
            <div
              className={cn(
                "work-3 absolute inset-1 bg-zinc-300 rounded-2xl transition-all ease duration-300 origin-bottom",
                !disabled && "group-hover:transform-[rotateX(-30deg)]",
              )}
            />
            <div
              className={cn(
                "work-2 absolute inset-1 bg-zinc-200 rounded-2xl transition-all ease duration-300 origin-bottom",
                !disabled && "group-hover:transform-[rotateX(-38deg)]",
              )}
            />

            <div
              className={cn(
                "work-1 absolute bottom-0 w-full h-[84px] rounded-2xl rounded-tr-none transition-all ease duration-300 origin-bottom flex",
                "bg-linear-to-t from-(--folder-front-from) to-(--folder-front-to)",
                "after:absolute after:content-[''] after:bottom-[99%] after:right-0 after:w-[72px] after:h-[9px] after:rounded-t-2xl after:bg-(--folder-front-top)",
                "before:absolute before:content-[''] before:-top-[6px] before:right-[70px] before:size-1.5 before:bg-(--folder-front-top) before:[clip-path:polygon(100%_14%,50%_100%,100%_100%)]",
                !disabled &&
                  "group-hover:shadow-[inset_0_20px_40px_var(--folder-inner-highlight),inset_0_-20px_40px_var(--folder-inner-shadow)] group-hover:transform-[rotateX(-46deg)_translateY(1px)]",
                frontIcon ? "items-center justify-center" : "items-center justify-center",
              )}
            >
              {frontIcon && (
                <div className="text-white/90 [&>svg]:h-11 [&>svg]:w-11">{frontIcon}</div>
              )}

              {!frontIcon && (
                <>
                  {isVirtualTags ? (
                    <Tag className="h-10 w-10 text-white/85" />
                  ) : isLibrary ? (
                    <HardDrive className="h-10 w-10 text-white/85" />
                  ) : isDir ? (
                    <Folder className="h-10 w-10 text-white/85" />
                  ) : null}
                </>
              )}
            </div>
          </div>

          {scaleWithText && (
            <div className="w-full pt-1.5 text-center min-w-0 overflow-hidden">
              <div className="w-full max-w-full truncate text-xs font-medium text-foreground" title={realName}>
                {realName}
              </div>
              <div className="w-full max-w-full truncate text-[11px] font-normal text-muted-foreground" title={realSubtitle}>
                {realSubtitle}
              </div>
            </div>
          )}
        </div>

        {!scaleWithText && (
          <div className="w-full pt-1.5 text-center min-w-0 overflow-hidden">
            <div className="w-full max-w-full truncate text-xs font-medium text-foreground" title={realName}>
              {realName}
            </div>
            <div className="w-full max-w-full truncate text-[11px] font-normal text-muted-foreground" title={realSubtitle}>
              {realSubtitle}
            </div>
          </div>
        )}
      </section>
    </button>
  );
}
