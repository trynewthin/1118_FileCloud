import { useCallback, useEffect, useState } from "react";

export type BackgroundMode = "glow" | "image";

export interface BackgroundSettings {
  // 背景模式：光晕 / 图片
  mode: BackgroundMode;
  // 图片背景地址，仅在 image 模式生效
  imageUrl: string;
}

const STORAGE_KEY = "filecloud-background-settings";

// 模块级全局状态，确保多个组件之间同步
let currentSettings: BackgroundSettings | null = null;

type Listener = (settings: BackgroundSettings) => void;
const listeners = new Set<Listener>();

// 从 localStorage 读取并初始化全局设置
function loadInitialSettings(): BackgroundSettings {
  if (currentSettings) return currentSettings;

  let next: BackgroundSettings = { mode: "glow", imageUrl: "" };

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BackgroundSettings>;
        const mode: BackgroundMode = parsed.mode === "image" ? "image" : "glow";
        const imageUrl = typeof parsed.imageUrl === "string" ? parsed.imageUrl : "";
        next = { mode, imageUrl };
      }
    } catch {
      // 忽略解析错误，回退到默认值
    }
  }

  currentSettings = next;
  persistSettings(next);
  return next;
}

// 将设置持久化到 localStorage，并在 DOM 上打标
function persistSettings(settings: BackgroundSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.document.documentElement.setAttribute("data-root-background-mode", settings.mode);
  } catch {
    // 忽略持久化错误
  }
}

// 更新全局设置并通知所有订阅者
function updateGlobalSettings(next: BackgroundSettings) {
  currentSettings = next;
  persistSettings(next);

  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch {
      // 单个订阅失败不影响其他订阅
    }
  });
}

/**
 * 全局背景设置 Hook
 * - 使用模块级全局状态 + 订阅机制，保证多个组件间同步
 * - 通过 localStorage 持久化背景模式与图片地址
 */
export function useBackgroundSettings() {
  const [settings, setSettingsState] = useState<BackgroundSettings>(() => loadInitialSettings());

  // 订阅全局设置变更
  useEffect(() => {
    const listener: Listener = (next) => {
      setSettingsState(next);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setSettings = useCallback(
    (updater: BackgroundSettings | ((prev: BackgroundSettings) => BackgroundSettings)) => {
      const base = loadInitialSettings();
      const next =
        typeof updater === "function"
          ? (updater as (prev: BackgroundSettings) => BackgroundSettings)(base)
          : updater;
      updateGlobalSettings(next);
    },
    [],
  );

  const setMode = useCallback(
    (mode: BackgroundMode) => {
      setSettings((prev) => ({ ...prev, mode }));
    },
    [setSettings],
  );

  const setImageUrl = useCallback(
    (imageUrl: string) => {
      setSettings((prev) => ({ ...prev, imageUrl }));
    },
    [setSettings],
  );

  const reset = useCallback(() => {
    const next: BackgroundSettings = { mode: "glow", imageUrl: "" };
    updateGlobalSettings(next);
  }, []);

  return {
    settings,
    setSettings,
    setMode,
    setImageUrl,
    reset,
  };
}
