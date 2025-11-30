import { useEffect, useState } from "react";

const STORAGE_KEY = "filecloud-ui-compat-mode";

// 读取初始兼容模式：localStorage 优先，其次参考 prefers-reduced-motion
function getInitialCompatMode(): boolean {
  if (typeof window === "undefined") return false;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "on") return true;
  if (stored === "off") return false;

  // 没有显式设置时，遵从系统的减少动效偏好
  try {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq && mq.matches) return true;
  } catch {
    // ignore
  }

  return false;
}

/**
 * UI 兼容模式 Hook
 * - compatMode=true 时，应尽量关闭重动画 / 大面积模糊等效果
 * - 通过 data-ui-compat-mode 属性暴露给全局 CSS
 */
export function useUiCompat() {
  const [compatMode, setCompatMode] = useState<boolean>(() => getInitialCompatMode());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-ui-compat-mode", compatMode ? "on" : "off");
    try {
      window.localStorage.setItem(STORAGE_KEY, compatMode ? "on" : "off");
    } catch {
      // ignore
    }
  }, [compatMode]);

  return { compatMode, setCompatMode };
}
