import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";

interface SettingsGridCardProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  rightSlot?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const SettingsGridCard: FC<SettingsGridCardProps> = ({
  title,
  description,
  rightSlot,
  children,
  className,
  contentClassName,
}) => {
  return (
    <GlassCard variant="lite" className={cn("p-3", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {typeof title === "string" ? title : title}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground mt-1">
              {typeof description === "string" ? description : description}
            </div>
          )}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>

      {children ? <div className={cn("mt-2", contentClassName)}>{children}</div> : null}
    </GlassCard>
  );
};
