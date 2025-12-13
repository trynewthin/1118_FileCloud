import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import React, { forwardRef } from "react";

interface GlassButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  glassVariant?: "strong" | "lite" | "ghost";
}

export const GlassButtonGroup = forwardRef<HTMLDivElement, GlassButtonGroupProps>(
  ({ className, glassVariant = "strong", children, ...props }, ref) => {
    const glassClass = {
      strong: DS.glass.strong,
      lite: DS.glass.lite,
      ghost: "bg-transparent hover:bg-accent/50",
    }[glassVariant];

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center",
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // 移除默认 hover，由 glass 效果接管
          glassVariant !== "ghost" && "hover:bg-background/80 border-border/20",
          cn(DS.radius.full, "button-rect:rounded-xl"),
          glassClass,
          "shadow-sm hover:shadow-md hover:scale-[1.04] active:scale-[0.96]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassButtonGroup.displayName = "GlassButtonGroup";
