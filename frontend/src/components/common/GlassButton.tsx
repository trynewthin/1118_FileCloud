import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DS } from "@/theme/design-system";
import React, { forwardRef } from "react";

type ButtonProps = React.ComponentProps<typeof Button>;

interface GlassButtonProps extends ButtonProps {
  glassVariant?: "strong" | "lite" | "ghost";
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, glassVariant = "strong", variant = "ghost", size, ...props }, ref) => {
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
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          // 移除默认的 ghost hover，由 glass 效果接管
          glassVariant !== "ghost" && "hover:bg-background/80 border-border/20",
          // 只有图标时，默认用 full 圆角，否则用 lg
          (size === "icon" || size === "icon-sm" || size === "icon-lg")
            ? cn(DS.radius.full, "button-rect:rounded-xl")
            : cn(DS.radius.lg, "button-rect:rounded-xl"),
          glassClass,
          "shadow-sm hover:shadow-md hover:scale-[1.04] active:scale-[0.96]",
          className
        )}
        {...props}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";

export const GlassIconButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <GlassButton
        ref={ref}
        size={size ?? "icon-sm"}
        className={cn("h-9 w-9", className)}
        {...props}
      >
        <span className="inline-flex items-center justify-center [&>svg]:text-foreground!">
          {children}
        </span>
      </GlassButton>
    );
  }
);
GlassIconButton.displayName = "GlassIconButton";
