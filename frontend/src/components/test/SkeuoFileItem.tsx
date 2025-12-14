import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SkeuoFileItemProps {
  name: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  thumbnailUrl?: string;
}

export function SkeuoFileItem({
  name,
  subtitle,
  selected = false,
  disabled = false,
  onClick,
  icon,
  thumbnailUrl,
}: SkeuoFileItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "inline-flex w-fit",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <div
        className={cn(
          disabled ? "" : "group",
          "relative flex flex-col items-center justify-center",
          disabled ? "opacity-60" : "",
        )}
      >
        <div
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
              "bg-linear-to-b from-slate-50/95 via-slate-100/85 to-slate-200/75",
              "shadow-[0_14px_26px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.75)]",
              "border border-black/5",
              !disabled && "transition-transform duration-300 ease group-hover:-translate-y-px",
            )}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.75),transparent_55%)]" />

            <div
              className={cn(
                "absolute right-0 top-0 h-6 w-6",
                "bg-linear-to-b from-white/80 to-white/10",
                "clip-path-[polygon(0_0,100%_0,100%_100%)]",
              )}
            />

            <div className="relative flex h-full w-full items-center justify-center">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="text-slate-900/60 [&>svg]:h-9 [&>svg]:w-9">
                  {icon ?? <FileText className="h-9 w-9" />}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full pt-1.5 text-center">
          <div className="truncate text-xs font-medium text-foreground" title={name}>
            {name}
          </div>
          <div className="truncate text-[11px] font-normal text-muted-foreground" title={subtitle}>
            {subtitle}
          </div>
        </div>
      </div>
    </button>
  );
}
