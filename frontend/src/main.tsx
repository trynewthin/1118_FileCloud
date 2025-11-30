import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// 初始化全局主题（浅色 / 深色）以及 UI 兼容模式
// 主题：优先使用 localStorage 中保存的 theme，其次回退到系统配色偏好
// 兼容模式：优先使用 localStorage 中保存的 filecloud-ui-compat-mode，其次参考系统的减少动效偏好
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // 深浅模式
  const stored = window.localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const shouldUseDark = stored === "dark" || (!stored && prefersDark);

  if (shouldUseDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  // 颜色主题
  const colorTheme = window.localStorage.getItem("filecloud-color-theme");
  if (colorTheme) {
    document.documentElement.setAttribute("data-color-theme", colorTheme);
  }

  // UI 兼容模式（关闭部分动画以适配存在闪烁/性能问题的设备）
  const compatStored = window.localStorage.getItem("filecloud-ui-compat-mode");
  if (compatStored === "on") {
    document.documentElement.setAttribute("data-ui-compat-mode", "on");
  } else if (compatStored === "off") {
    document.documentElement.setAttribute("data-ui-compat-mode", "off");
  } else {
    // 未显式设置时，参考系统减少动效偏好
    try {
      const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      if (mq && mq.matches) {
        document.documentElement.setAttribute("data-ui-compat-mode", "on");
      }
    } catch {
      // ignore
    }
  }
})();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
