import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageContainerProps extends PropsWithChildren {
  title?: string;
  action?: ReactNode;
  showBack?: boolean;
  className?: string;
}

export const PageContainer: FC<PageContainerProps> = ({
  title,
  action,
  showBack = false,
  children,
  className,
}) => {
  const { setConfig } = usePageHeader();
  const navigate = useNavigate();

  useEffect(() => {
    setConfig({ title });
    return () => {
      setConfig({ title: undefined });
    };
  }, [title, setConfig]);

  return (
    <div className={cn("flex min-h-0 flex-col space-y-4", className)}>
      {(showBack || action) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-[12px] border border-border bg-background/80 text-foreground shadow-sm"
                onClick={() => navigate(-1)}
                title="返回"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0 h-full flex flex-col pb-6 md:pb-0">{children}</div>
    </div>
  );
};
