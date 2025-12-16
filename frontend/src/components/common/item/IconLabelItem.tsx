import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

type RadiusVariant = keyof typeof DS.radius;
type GlassVariant = "strong" | "lite" | "ghost";

export interface IconLabelItemProps {
  label: string;
  icon: ReactNode;
  background?: ReactNode;
  glassVariant?: GlassVariant;
  radiusVariant?: RadiusVariant;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  iconWrapperClassName?: string;
  backgroundClassName?: string;
  labelClassName?: string;
}

export function IconLabelItem({
  label,
  icon,
  background,
  glassVariant = "strong",
  radiusVariant,
  disabled = false,
  selected = false,
  onClick,
  className,
  iconWrapperClassName,
  backgroundClassName,
  labelClassName,
}: IconLabelItemProps) {
  const glassClass = {
    strong: DS.glass.strong,
    lite: DS.glass.lite,
    ghost: "bg-transparent border-transparent shadow-none",
  }[glassVariant];

  const effectiveRadiusClass = radiusVariant
    ? DS.radius[radiusVariant]
    : cn(DS.radius.full, "button-rect:rounded-2xl");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "inline-flex w-20 flex-col items-center gap-1.5 select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className
      )}
    >
      <div
        className={cn(
          "relative grid h-16 w-16 place-items-center overflow-hidden",
          effectiveRadiusClass,
          glassClass,
          glassVariant !== "ghost" && "shadow-[0_10px_20px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.55)]",
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          !disabled && "hover:scale-[1.03] active:scale-[0.96]",
          selected && "ring-2 ring-primary/55",
          iconWrapperClassName
        )}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-0",
            backgroundClassName
          )}
        >
          {background}
        </div>

        <div className="relative z-10 text-foreground/90 [&>svg]:h-7 [&>svg]:w-7">{icon}</div>
      </div>

      <div
        className={cn(
          "w-full text-center",
          "text-[11px] leading-4 font-medium text-foreground/85",
          "truncate",
          labelClassName
        )}
        title={label}
      >
        {label}
      </div>
    </button>
  );
}
