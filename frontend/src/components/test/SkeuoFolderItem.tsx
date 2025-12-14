import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  name: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
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
  disabled = false,
  onClick,
  folderColor,
  frontIcon,
  scale = 1,
  scaleWithText = true,
}: SkeuoFolderItemProps) {
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
      className={cn("inline-flex w-fit", disabled ? "cursor-not-allowed" : "cursor-pointer")}
    >
      <section
        style={folderStyle}
        className={cn(
          disabled ? "" : "group",
          "relative flex h-full w-full flex-col items-center justify-center",
          disabled ? "opacity-60" : "",
        )}
      >
        <div
          className="origin-top transform-gpu"
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
                frontIcon ? "items-center justify-center" : "items-end",
              )}
            >
              {frontIcon && (
                <div className="text-white/90 [&>svg]:h-11 [&>svg]:w-11">{frontIcon}</div>
              )}
            </div>
          </div>

          {scaleWithText && (
            <div className="w-full pt-1.5 text-center">
              <div className="truncate text-xs font-medium text-foreground" title={name}>
                {name}
              </div>
              <div className="truncate text-[11px] font-normal text-muted-foreground" title={subtitle}>
                {subtitle}
              </div>
            </div>
          )}
        </div>

        {!scaleWithText && (
          <div className="w-full pt-1.5 text-center">
            <div className="truncate text-xs font-medium text-foreground" title={name}>
              {name}
            </div>
            <div className="truncate text-[11px] font-normal text-muted-foreground" title={subtitle}>
              {subtitle}
            </div>
          </div>
        )}
      </section>
    </button>
  );
}
