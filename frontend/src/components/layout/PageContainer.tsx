import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { DS } from "@/theme/design-system";
import { FolderGridMenu } from "@/components/layout/header/FolderGridMenu";
import { PageContainerHeader } from "@/components/layout/header/PageContainerHeader";

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
  const location = useLocation();
  const [folderOpen, setFolderOpen] = useState(false);
  const [lastBrowsePath, setLastBrowsePath] = useState<string>("/files");
  const folderButtonRef = useRef<HTMLButtonElement | null>(null);
  const [folderAnchorRect, setFolderAnchorRect] = useState<Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height"> | null>(null);

  const handleBackClick = () => {
    if (showBack) {
      if (onBack) {
        onBack();
      } else {
        navigate(-1);
      }
      return;
    }

    navigate("/");
  };

  useEffect(() => {
    setConfig({ title });
    return () => {
      setConfig({ title: undefined });
    };
  }, [title, setConfig]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/files") || path.startsWith("/preview")) {
      const fullPath = location.search ? `${path}${location.search}` : path;
      setLastBrowsePath(fullPath);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    setFolderOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!folderOpen) return;

    const update = () => {
      const el = folderButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setFolderAnchorRect({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [folderOpen]);

  return (
    <div className={cn("relative flex min-h-0 flex-col space-y-4 w-full h-full pt-1", className)}>
      {/* Header Area (Back button, Center content & Actions) */}
      <PageContainerHeader
        title={title}
        folderOpen={folderOpen}
        onToggleFolderOpen={() => setFolderOpen((v) => !v)}
        folderButtonRef={folderButtonRef}
        showBack={showBack}
        onBackClick={handleBackClick}
        leftAction={leftAction}
        headerCenter={headerCenter}
        action={action}
      />

      {/* Content Area */}
      <div className={cn(DS.layout.pageBody)}>
        {children}
      </div>

      <FolderGridMenu
        open={folderOpen}
        onOpenChange={setFolderOpen}
        lastBrowsePath={lastBrowsePath}
        anchorRect={folderAnchorRect}
      />
    </div>
  );
};
