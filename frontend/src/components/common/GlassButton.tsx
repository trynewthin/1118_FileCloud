import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DS } from "@/lib/design-system";
import React, { forwardRef } from "react";

type ButtonProps = React.ComponentProps<typeof Button>;

interface GlassButtonProps extends ButtonProps {
  glassVariant?: "strong" | "lite" | "ghost";
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, glassVariant = "lite", variant = "ghost", size, ...props }, ref) => {
    const glassClass = {
      strong: DS.glass.strong,
      lite: DS.glass.lite,
      ghost: "bg-transparent hover:bg-accent/50",
    }[glassVariant];

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "transition-all duration-300",
          // 移除默认的 ghost hover，由 glass 效果接管
          glassVariant !== "ghost" && "hover:bg-background/80 border-border/20",
          // 只有图标时，默认用 full 圆角，否则用 lg
          (size === "icon" || size === "icon-sm" || size === "icon-lg")
            ? DS.radius.full
            : DS.radius.lg,
          glassClass,
          "shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
          className
        )}
        {...props}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";
