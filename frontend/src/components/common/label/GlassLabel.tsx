import React, { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";

interface GlassLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  tintClassName?: string;
  icon?: React.ReactNode;
  glassVariant?: "strong" | "lite" | "ghost";
}

export const GlassLabel = forwardRef<HTMLSpanElement, GlassLabelProps>(
  ({ className, tintClassName, icon, glassVariant = "lite", children, ...props }, ref) => {
    const glassClass = {
      strong: DS.glass.strong,
      lite: DS.glass.lite,
      ghost: "bg-transparent border-transparent shadow-none",
    }[glassVariant];

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1",
          "h-7 px-2",
          "text-xs font-medium",
          "select-none",
          // 玻璃拟态与圆角：响应全局按钮形状
          glassClass,
          cn(DS.radius.full, "button-rect:rounded-xl"),
          // 让标签更像 chip：降低阴影侵入感（背景/边框交给 DS.glass 统一管理）
          "shadow-none",
          tintClassName,
          className
        )}
        {...props}
      >
        {icon && (
          <span className="inline-flex items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
          </span>
        )}
        <span className="truncate">{children}</span>
      </span>
    );
  }
);

GlassLabel.displayName = "GlassLabel";
