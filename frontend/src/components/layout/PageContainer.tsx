import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { ArrowLeft } from "lucide-react";
import { GlassIconButton } from "@/components/common/GlassButton";
import { DS } from "@/theme/design-system";

interface PageContainerProps extends PropsWithChildren {
  title?: string;
  /** 左侧操作区（返回按钮之后） */
  leftAction?: ReactNode;
  /** 右侧操作区 */
  action?: ReactNode;
  showBack?: boolean;
  className?: string;
  headerCenter?: ReactNode;
  onBack?: () => void;
}

export const PageContainer: FC<PageContainerProps> = ({
  title,
  leftAction,
  action,
  showBack = false,
  children,
  className,
  headerCenter,
  onBack,
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
    <div className={cn("relative flex min-h-0 flex-col space-y-4 w-full h-full pt-1", className)}>
      {/* Header Area (Back button, Center content & Actions) */}
      {(showBack || leftAction || action || headerCenter) && (
        <div className="flex items-center justify-between shrink-0 z-10 relative mt-1 px-4">
          <div className="flex items-center gap-2">
            {showBack && (
              <GlassIconButton
                glassVariant="lite"
                onClick={() => {
                  if (onBack) {
                    onBack();
                  } else {
                    navigate(-1);
                  }
                }}
                title="返回"
              >
                <ArrowLeft className="h-5 w-5" />
              </GlassIconButton>
            )}
            {leftAction}
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
