import React, { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

export interface GlassSegmentedSwitchOption<T extends string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface GlassSegmentedSwitchProps<T extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<GlassSegmentedSwitchOption<T>>;
  glassVariant?: "strong" | "lite" | "ghost";
  size?: "sm" | "md";
}

function GlassSegmentedSwitchInner<T extends string>(
  {
    className,
    glassVariant = "strong",
    size = "md",
    value,
    onValueChange,
    options,
    ...props
  }: GlassSegmentedSwitchProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
    const glassClass = {
      strong: DS.glass.strong,
      lite: DS.glass.lite,
      ghost: "bg-transparent hover:bg-accent/50",
    }[glassVariant];

    const containerClassName = cn(
      "inline-flex items-center h-9 px-1 gap-1",
      "button-rect:px-1.5 button-rect:gap-1.5",
      cn(DS.radius.full, "button-rect:rounded-xl"),
      glassClass,
      "shadow-sm",
      className
    );

    const itemBaseClassName = cn(
      "inline-flex items-center justify-center",
      "transition-colors",
      cn(DS.radius.full, "button-rect:rounded-md"),
      "text-foreground/80 hover:text-foreground",
      glassVariant !== "ghost" && "hover:bg-background/80",
      "disabled:opacity-50 disabled:pointer-events-none"
    );

    const itemSizeClassName =
      size === "sm" ? "h-7 w-7" : "h-8 w-8";

    return (
      <div ref={ref} className={containerClassName} {...props}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => onValueChange(opt.value)}
              aria-pressed={selected}
              title={opt.label ?? "切换"}
              className={cn(
                itemBaseClassName,
                itemSizeClassName,
                selected && "bg-background/80 border border-border/30 text-foreground"
              )}
            >
              <span className="inline-flex items-center justify-center gap-1 [&>svg]:h-3.5 [&>svg]:w-3.5">
                {opt.icon}
                {opt.label ? <span className="sr-only">{opt.label}</span> : <span className="sr-only">切换</span>}
              </span>
            </button>
          );
        })}
      </div>
    );
}

const GlassSegmentedSwitchBase = forwardRef(GlassSegmentedSwitchInner);
(GlassSegmentedSwitchBase as any).displayName = "GlassSegmentedSwitch";

export const GlassSegmentedSwitch = GlassSegmentedSwitchBase as <T extends string>(
  props: GlassSegmentedSwitchProps<T> & React.RefAttributes<HTMLDivElement>
) => React.ReactElement;
