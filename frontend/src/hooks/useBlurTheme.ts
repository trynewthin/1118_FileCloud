import { useCallback, useEffect, useState } from "react";

export type BlurTheme = "classic" | "mac";

const STORAGE_KEY = "filecloud-blur-theme";

function getInitialBlurTheme(): BlurTheme {
  if (typeof window === "undefined") {
    return "classic";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "mac" || stored === "classic") {
      return stored;
    }
  } catch {
    // 忽略存储读取错误
  }

  return "classic";
}

/**
 * 毛玻璃主题 Hook：在标准与 macOS 风格之间切换
 */
export function useBlurTheme() {
  const [blurTheme, setBlurThemeState] = useState<BlurTheme>(() => getInitialBlurTheme());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-blur-theme", blurTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, blurTheme);
    } catch {
      // 忽略持久化错误
    }
  }, [blurTheme]);

  const setBlurTheme = useCallback((theme: BlurTheme) => {
    setBlurThemeState(theme);
  }, []);

  return { blurTheme, setBlurTheme };
}
