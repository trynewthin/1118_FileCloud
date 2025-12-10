import { useCallback, useEffect, useState } from "react";

export type BackgroundMode = "glow" | "image";

// 图片来源类型：url 为外部链接，local 为本地上传
export type ImageSourceType = "url" | "local";

export interface BackgroundSettings {
  // 背景模式：光晕 / 图片
  mode: BackgroundMode;
  // 图片来源类型
  imageSourceType: ImageSourceType;
  // 图片背景地址（外部 URL），仅在 image 模式 + url 来源时生效
  imageUrl: string;
  // 本地图片 ID（IndexedDB 中的 key），仅在 image 模式 + local 来源时生效
  localImageId: string;
}

const STORAGE_KEY = "filecloud-background-settings";

// 模块级全局状态，确保多个组件之间同步
let currentSettings: BackgroundSettings | null = null;

type Listener = (settings: BackgroundSettings) => void;
const listeners = new Set<Listener>();

// 默认设置
const defaultSettings: BackgroundSettings = {
  mode: "glow",
  imageSourceType: "url",
  imageUrl: "",
  localImageId: "",
};

// 从 localStorage 读取并初始化全局设置
function loadInitialSettings(): BackgroundSettings {
  if (currentSettings) return currentSettings;

  let next: BackgroundSettings = { ...defaultSettings };

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BackgroundSettings>;
        const mode: BackgroundMode = parsed.mode === "image" ? "image" : "glow";
        const imageSourceType: ImageSourceType =
          parsed.imageSourceType === "local" ? "local" : "url";
        const imageUrl = typeof parsed.imageUrl === "string" ? parsed.imageUrl : "";
        const localImageId =
          typeof parsed.localImageId === "string" ? parsed.localImageId : "";
        next = { mode, imageSourceType, imageUrl, localImageId };
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
      setSettings((prev) => ({ ...prev, imageUrl, imageSourceType: "url" as ImageSourceType }));
    },
    [setSettings],
  );

  const setLocalImageId = useCallback(
    (localImageId: string) => {
      setSettings((prev) => ({ ...prev, localImageId, imageSourceType: "local" as ImageSourceType }));
    },
    [setSettings],
  );

  const setImageSourceType = useCallback(
    (imageSourceType: ImageSourceType) => {
      setSettings((prev) => ({ ...prev, imageSourceType }));
    },
    [setSettings],
  );

  const reset = useCallback(() => {
    updateGlobalSettings({ ...defaultSettings });
  }, []);

  return {
    settings,
    setSettings,
    setMode,
    setImageUrl,
    setLocalImageId,
    setImageSourceType,
    reset,
  };
}
