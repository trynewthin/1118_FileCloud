import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { ArrowLeft } from "lucide-react";
import { GlassButton } from "@/components/common/GlassButton";
import { DS } from "@/lib/design-system";

interface PageContainerProps extends PropsWithChildren {
  title?: string;
  action?: ReactNode;
  showBack?: boolean;
  className?: string;
  headerCenter?: ReactNode;
}

export const PageContainer: FC<PageContainerProps> = ({
  title,
  action,
  showBack = false,
  children,
  className,
  headerCenter,
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
    <div className={cn("relative flex min-h-0 flex-col space-y-4 w-full h-full overflow-hidden pt-1", className)}>
      {/* Header Area (Back button, Center content & Actions) */}
      {(showBack || action || headerCenter) && (
        <div className="flex items-center justify-between shrink-0 z-10 relative mt-1 px-4">
          <div className="flex items-center gap-2">
            {showBack && (
              <GlassButton
                glassVariant="lite"
                size="icon"
                className="h-9 w-9 rounded-full text-foreground hover:text-primary"
                onClick={() => navigate(-1)}
                title="返回"
              >
                <ArrowLeft className="h-5 w-5" />
              </GlassButton>
            )}
          </div>

          {headerCenter && (
            <div className="absolute inset-x-0 flex justify-center pointer-events-none">
              <div className="pointer-events-auto">
                {headerCenter}
              </div>
            </div>
          )}

          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      {/* Content Area */}
      <div className={cn(DS.layout.pageBody)}>
        {children}
      </div>
    </div>
  );
};
