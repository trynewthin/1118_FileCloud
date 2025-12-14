import type { FC, ReactNode, Ref } from "react";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { GlassButtonGroup } from "@/components/common/button/GlassButtonGroup";
import { GlobalHeaderActions } from "@/components/layout/header/GlobalHeaderActions";
import { GlassCard } from "@/components/common/GlassCard";

interface PageContainerHeaderProps {
  title?: string;
  folderOpen: boolean;
  onToggleFolderOpen: () => void;
  folderButtonRef: Ref<HTMLButtonElement>;

  showBack: boolean;
  onBackClick: () => void;

  leftAction?: ReactNode;
  headerCenter?: ReactNode;
  action?: ReactNode;
}

export const PageContainerHeader: FC<PageContainerHeaderProps> = ({
  title,
  folderOpen,
  onToggleFolderOpen,
  folderButtonRef,
  showBack,
  onBackClick,
  leftAction,
  headerCenter,
  action,
}) => {
  return (
    <div className="shrink-0 z-10 relative mt-1 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <GlassButtonGroup glassVariant="lite">
          <GlassIconButton
            type="button"
            glassVariant="lite"
            onClick={onToggleFolderOpen}
            title={folderOpen ? "关闭菜单" : "打开菜单"}
            ref={folderButtonRef}
          >
            <LayoutGrid className="h-4 w-4" />
          </GlassIconButton>

          <GlassIconButton
            type="button"
            glassVariant="lite"
            onClick={onBackClick}
            title={showBack ? "返回" : "返回首页"}
          >
            <ArrowLeft className="h-4 w-4" />
          </GlassIconButton>
        </GlassButtonGroup>

        <div className="flex-1 flex items-center justify-center min-w-0">
          {title && (
            <GlassCard
              variant="lite"
              className="px-3 py-1.5 max-w-[70%] md:max-w-[520px]"
            >
              <div className="text-sm font-medium truncate text-center">{title}</div>
            </GlassCard>
          )}
        </div>

        <div className="flex items-center">
          <GlobalHeaderActions />
        </div>
      </div>

      {(leftAction || action || headerCenter) && (
        <div className="grid grid-cols-3 items-center">
          <div className="flex items-center gap-2 justify-start">{leftAction}</div>
          <div className="flex justify-center">{headerCenter}</div>
          <div className="flex items-center gap-2 justify-end">{action}</div>
        </div>
      )}
    </div>
  );
};
