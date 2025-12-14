import type { FC, PropsWithChildren, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { FolderGridMenu } from "@/components/layout/header/FolderGridMenu";
import { PageContainerHeader } from "@/components/layout/header/PageContainerHeader";
import { BlurFade } from "@/components/common/blur-fade";

interface PageContainerProps extends PropsWithChildren {
  title?: string;
  /** 顶部工具栏层（不滚动），位于 PageContainerHeader 之下 */
  toolbar?: ReactNode;
  /** 内容层额外样式（用于覆盖 DS.layout.pageBody 的默认 padding 等） */
  bodyClassName?: string;
  /** 头部/工具栏是否采用覆盖层模式（不占位，内容可滚到页面顶部并在其下方穿过） */
  headerOverlay?: boolean;
  /** 覆盖层模式下，内容层的顶部留白（用于首屏不被头部遮挡） */
  headerOverlayTopInsetClassName?: string;
  /** 覆盖层模式下，顶部遮罩高度/样式（遮罩层级位于内容与 Header/toolbar 之间） */
  headerOverlayMaskClassName?: string;
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
  toolbar,
  bodyClassName,
  headerOverlay = false,
  headerOverlayTopInsetClassName,
  headerOverlayMaskClassName,
  leftAction,
  action,
  showBack = false,
  children,
  className,
  headerCenter,
  onBack,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pageGutterClassName = "px-6 md:px-12";
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

  const headerNode = (
    <div
      className={cn(
        "pt-[calc(1rem+env(safe-area-inset-top))]",
        pageGutterClassName
      )}
    > 
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

      {toolbar && <div className="mt-3">{toolbar}</div>}
    </div>
  );

  return (
    <div className={cn("relative flex min-h-0 flex-col w-full h-full", className)}>
      {headerOverlay ? (
        <>
          <div
            className={cn(
              "absolute inset-0 flex min-h-0 flex-col",
              DS.layout.pageBody,
              "overflow-hidden",
              "pb-0 md:pb-0",
              pageGutterClassName,
              headerOverlayTopInsetClassName,
              bodyClassName
            )}
          >
            {children}
          </div>

          {headerOverlayMaskClassName && (
            <BlurFade
              inView={false}
              edgeBlur="top"
              edgeSizePx={36}
              edgeStrength={0.06}
              cornerStrength={0.12}
              variant={{ hidden: { y: 0 }, visible: { y: 0 } }}
              className={cn(
                "pointer-events-none fixed inset-x-0 top-0 z-20",
                headerOverlayMaskClassName
              )}
            >
              <div className="h-full w-full" />
            </BlurFade>
          )}

          <div className="pointer-events-none fixed inset-x-0 top-0 z-30">
            <div className="pointer-events-auto">{headerNode}</div>
          </div>
        </>
      ) : (
        <>
          {/* 顶部层：承担 safe-area 顶部间距，不参与滚动 */}
          <div className="shrink-0">{headerNode}</div>

          {/* 内容层：占满剩余高度。具体是否滚动由页面内部自行决定（推荐在此层内部设置 overflow-y-auto） */}
          <div
            className={cn(
              DS.layout.pageBody,
              "min-h-0 overflow-hidden",
              "pb-0 md:pb-0",
              pageGutterClassName,
              bodyClassName
            )}
          >
            {children}
          </div>
        </>
      )}

      <FolderGridMenu
        open={folderOpen}
        onOpenChange={setFolderOpen}
        lastBrowsePath={lastBrowsePath}
        anchorRect={folderAnchorRect}
      />
    </div>
  );
};
