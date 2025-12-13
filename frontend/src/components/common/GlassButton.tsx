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
          // 圆角规范：图标按钮更圆；普通按钮更大圆角；矩形模式由 button-rect 变体统一覆盖
          cn(DS.radius.full, "button-rect:rounded-xl"),
          // 高度规范：icon/icon-sm 默认统一为 h-9 w-9（可通过 className 覆盖）
          (size === "icon" || size === "icon-sm") && "h-9 w-9",
          glassClass,
          // classic：更克制；mac：更强的阴影与缩放
          "shadow-sm hover:shadow-sm hover:scale-[1.01] blur-mac:hover:shadow-md blur-mac:hover:scale-[1.04] active:scale-[0.96]",
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
