import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

// 初始化全局主题（浅色 / 深色）
// 优先使用 localStorage 中保存的 theme，其次回退到系统配色偏好
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
})();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
