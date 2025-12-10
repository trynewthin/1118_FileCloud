import { AmbientGlow } from "@/components/common/AmbientGlow";
import { useUiCompat } from "@/hooks/useUiCompat";
import { useBackgroundSettings } from "@/hooks/useBackgroundSettings";
import { cn } from "@/lib/utils";

interface LayoutBackgroundProps {
  className?: string;
}

/**
 * 布局背景组件：集中管理全局光晕，便于在根布局复用与维护
 */
export function LayoutBackground({ className }: LayoutBackgroundProps) {
  const { compatMode } = useUiCompat();
  const { settings } = useBackgroundSettings();

  const isImageMode = settings.mode === "image" && settings.imageUrl;

  if (isImageMode) {
    return (
      <div className={cn("pointer-events-none absolute inset-0 overflow-hidden z-0", className)}>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80 dark:opacity-70"
          style={{ backgroundImage: `url(${settings.imageUrl})` }}
        />
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden z-0", className)}>
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
    </div>
  );
}
