import type { FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsGroupProps {
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * 设置分组组件
 * 提供统一的小标题样式和内容容器
 */
export const SettingsGroup: FC<SettingsGroupProps> = ({
  title,
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-sm font-medium text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
};
