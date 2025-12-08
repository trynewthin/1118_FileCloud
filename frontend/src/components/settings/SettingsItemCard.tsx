import type { FC, ReactNode } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsItemCardProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  action?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * 基础设置项组件
 * - 左侧：标题 + 可选描述
 * - 右侧：自定义操作组件（如 Switch/Select）或默认箭头图标
 * - 当提供 onClick 且无 action 时，显示右箭头并可点击
 */
export const SettingsItemCard: FC<SettingsItemCardProps> = ({
  title,
  description,
  action,
  onClick,
  className,
}) => {
  const hasAction = !!action;
  const isClickable = !!onClick && !hasAction;

  return (
    <GlassCard
      variant="lite"
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3",
        isClickable && "cursor-pointer hover:bg-primary/5 transition-colors",
        className,
      )}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground">
          {typeof title === "string" ? title : title}
        </div>
        {description && (
          <div className="text-xs text-muted-foreground/70 mt-0.5">
            {typeof description === "string" ? description : description}
          </div>
        )}
      </div>

      {hasAction ? (
        action
      ) : isClickable ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </GlassCard>
  );
};
