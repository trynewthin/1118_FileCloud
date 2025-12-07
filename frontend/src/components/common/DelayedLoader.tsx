import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface DelayedLoaderProps {
  loading: boolean;
  children: ReactNode;
  fallback?: ReactNode; // 超过阈值后显示的内容，默认为 "加载中..."
  delay?: number; // 延迟阈值，单位 ms，默认 500ms
  className?: string; // 容器样式
}

export function DelayedLoader({
  loading,
  children,
  fallback,
  delay = 500,
  className = "",
}: DelayedLoaderProps) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (loading) {
      timer = setTimeout(() => {
        setShowFallback(true);
      }, delay);
    } else {
      setShowFallback(false);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [loading, delay]);

  // 如果正在加载且还没超过阈值，显示空白（或者什么都不渲染）
  // 如果正在加载且已超过阈值，显示 fallback
  // 如果加载完成，显示 children

  if (!loading) {
    return <>{children}</>;
  }

  if (showFallback) {
    return (
      <div className={className}>
        {fallback || (
          <div className="flex items-center justify-center h-full w-full text-muted-foreground animate-in fade-in zoom-in duration-300">
            加载中...
          </div>
        )}
      </div>
    );
  }

  // 加载中但在阈值内，显示空白占位（保持布局防止跳动）或 null
  return <div className={className} />;
}
