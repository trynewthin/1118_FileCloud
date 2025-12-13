import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import React, { forwardRef } from "react";
import { GlassIconButton } from "./GlassButton";

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

    const groupButtonClassName = cn("h-7! w-7!", cn(DS.radius.full, "button-rect:rounded-md"));

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center h-9 px-1 gap-1 button-rect:px-1.5 button-rect:gap-1.5",
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // 移除默认 hover，由 glass 效果接管
          glassVariant !== "ghost" && "hover:bg-background/80 border-border/20",
          cn(DS.radius.full, "button-rect:rounded-xl"),
          glassClass,
          // classic：更克制；mac：更强的阴影与缩放
          "shadow-sm hover:shadow-sm hover:scale-[1.01] blur-mac:hover:shadow-md blur-mac:hover:scale-[1.04] active:scale-[0.96]",
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) return child;

          // 已经是 GlassIconButton：统一注入组内缩小尺寸
          if (child.type === GlassIconButton) {
            const el = child as React.ReactElement<any>;
            return React.cloneElement(el, {
              className: cn(groupButtonClassName, el.props?.className),
            });
          }

          return (
            <GlassIconButton asChild glassVariant={glassVariant} className={groupButtonClassName}>
              {child}
            </GlassIconButton>
          );
        })}
      </div>
    );
  }
);

GlassButtonGroup.displayName = "GlassButtonGroup";
