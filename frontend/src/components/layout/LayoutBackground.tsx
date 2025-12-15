import { AuroraBackground } from "@/components/common/background/AuroraBackground";
import { AmbientGlow } from "@/components/common/background/AmbientGlow";
import { NebulaBackground } from "@/components/common/background/NebulaBackground";
import { useUiCompat } from "@/hooks/useUiCompat";
import { useBackgroundSettings } from "@/hooks/useBackgroundSettings";
import { cn } from "@/lib/utils";
import { getBackgroundImageUrl } from "@/lib/storage/backgroundStorage";

interface LayoutBackgroundProps {
  className?: string;
}

/**
 * 布局背景组件：集中管理全局光晕，便于在根布局复用与维护
 * 支持光晕背景、外部 URL 图片背景、后端存储图片背景
 */
export function LayoutBackground({ className }: LayoutBackgroundProps) {
  const { compatMode } = useUiCompat();
  const { settings } = useBackgroundSettings();

  const maskOpacity = typeof settings.maskOpacity === "number" ? settings.maskOpacity : 0;
  const blurPx = typeof settings.blurPx === "number" ? settings.blurPx : 0;

  // 判断是否为图片模式
  const isUrlImageMode = settings.mode === "image" && settings.imageSourceType === "url" && settings.imageUrl;
  const isLocalImageMode = settings.mode === "image" && settings.imageSourceType === "local" && settings.localImageId;
  const isImageMode = isUrlImageMode || isLocalImageMode;

  // 获取当前背景图片 URL
  // 对于后端存储的图片，直接使用 API URL，不需要异步加载
  const backgroundImageUrl = isUrlImageMode 
    ? settings.imageUrl 
    : isLocalImageMode 
      ? getBackgroundImageUrl(settings.localImageId) 
      : null;

  if (isImageMode && backgroundImageUrl) {
    return (
      <div className={cn("pointer-events-none absolute inset-0 overflow-hidden z-0", className)}>
        <div
          className="absolute -inset-6 bg-cover bg-center bg-no-repeat opacity-80 dark:opacity-70"
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? "scale(1.05)" : undefined,
            transformOrigin: "center",
          }}
        />

        {maskOpacity > 0 && (
          <div
            className="absolute inset-0 bg-white dark:bg-black"
            style={{ opacity: maskOpacity }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden z-0", className)}>
      <div
        className="absolute -inset-6"
        style={{
          filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
          transform: blurPx > 0 ? "scale(1.05)" : undefined,
          transformOrigin: "center",
        }}
      >
        {settings.mode === "aurora" ? (
          <AuroraBackground compatMode={compatMode} />
        ) : settings.mode === "nebula" ? (
          <NebulaBackground compatMode={compatMode} />
        ) : (
          <>
            <AmbientGlow
              position="top-right"
              variant="primary"
              compatMode={compatMode}
              className="pointer-events-none absolute"
            />
            <AmbientGlow
              position="bottom-left"
              variant="cool"
              compatMode={compatMode}
              className="pointer-events-none absolute"
            />
          </>
        )}
      </div>

      {maskOpacity > 0 && (
        <div
          className="absolute inset-0 bg-white dark:bg-black"
          style={{ opacity: maskOpacity }}
        />
      )}
    </div>
  );
}
