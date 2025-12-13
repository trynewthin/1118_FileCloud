import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { forwardRef, type HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "strong" | "lite" | "ghost";
  hoverEffect?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "lite", hoverEffect = false, children, ...props }, ref) => {
    const variantClass = {
      strong: DS.glass.strong,
      lite: DS.glass.lite,
      ghost: "bg-transparent border-transparent shadow-none",
    }[variant];

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden", // 防止内部内容溢出圆角
          cn("rounded-3xl", "button-rect:rounded-xl"),
          variantClass,
          hoverEffect && DS.interactive.hoverCard,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
