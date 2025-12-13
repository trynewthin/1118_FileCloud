import { useCallback, useEffect, useState } from "react";

export type ButtonShape = "round" | "rect";

const STORAGE_KEY = "filecloud-button-shape";

function getInitialButtonShape(): ButtonShape {
  if (typeof window === "undefined") {
    return "round";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "round" || stored === "rect") {
      return stored;
    }
  } catch {
    // 忽略存储读取错误
  }

  return "round";
}

/**
 * 按钮形状 Hook：全局控制按钮圆角风格（圆形/矩形）
 * - 通过 data-button-shape 属性暴露给全局 CSS
 */
export function useButtonShape() {
  const [buttonShape, setButtonShapeState] = useState<ButtonShape>(() => getInitialButtonShape());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-button-shape", buttonShape);
    try {
      window.localStorage.setItem(STORAGE_KEY, buttonShape);
    } catch {
      // 忽略持久化错误
    }
  }, [buttonShape]);

  const setButtonShape = useCallback((shape: ButtonShape) => {
    setButtonShapeState(shape);
  }, []);

  return { buttonShape, setButtonShape };
}
