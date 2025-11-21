import type { FC, PropsWithChildren, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends PropsWithChildren {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const PageContainer: FC<PageContainerProps> = ({
  title,
  description,
  action,
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-6", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
            {description && <p className="text-muted-foreground">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
