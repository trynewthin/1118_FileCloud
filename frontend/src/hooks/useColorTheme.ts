import { useCallback, useEffect, useState } from "react";

// 可用的颜色主题
export type ColorTheme = 
  | "ocean"    // 海洋蓝（默认）
  | "emerald"  // 翡翠绿
  | "violet"   // 紫罗兰
  | "rose"     // 玫瑰红
  | "amber"    // 琥珀橙
  | "slate"    // 石板灰
  | "cyan"     // 天青色
  | "indigo"   // 靛蓝色
  | "crimson"  // 绯红色
  | "lime"     // 青柠色
  | "fuchsia"  // 紫红色
  | "zinc"     // 墨黑色
  | "sunset"   // 日落 (紫+橙)
  | "aurora"   // 极光 (蓝+绿)
  | "neon"     // 霓虹 (青+粉)
  | "gold"     // 黑金
  | "prism";   // 棱镜 (多彩)

export interface ColorThemeInfo {
  id: ColorTheme;
  name: string;
  description: string;
  // 预览色（用于选择器显示）
  previewColor: string;
}

// 主题配置列表
export const COLOR_THEMES: ColorThemeInfo[] = [
  // --- 单色系列 ---
  {
    id: "crimson",
    name: "绯红色",
    description: "复古高贵，深沉热烈",
    previewColor: "oklch(0.50 0.20 5)",
  },
  {
    id: "rose",
    name: "玫瑰红",
    description: "温暖柔和，活力四射",
    previewColor: "oklch(0.60 0.18 10)",
  },
  {
    id: "amber",
    name: "琥珀橙",
    description: "温馨明亮，热情洋溢",
    previewColor: "oklch(0.70 0.16 60)",
  },
  {
    id: "lime",
    name: "青柠色",
    description: "酸性活力，极客先锋",
    previewColor: "oklch(0.65 0.20 130)",
  },
  {
    id: "emerald",
    name: "翡翠绿",
    description: "清新自然，生机盎然",
    previewColor: "oklch(0.55 0.18 160)",
  },
  {
    id: "cyan",
    name: "天青色",
    description: "清澈明亮，心旷神怡",
    previewColor: "oklch(0.60 0.15 220)",
  },
  {
    id: "ocean",
    name: "海洋蓝",
    description: "深邃宝石蓝，稳重高级",
    previewColor: "oklch(0.50 0.18 255)",
  },
  {
    id: "indigo",
    name: "靛蓝色",
    description: "深邃科技，静谧理性",
    previewColor: "oklch(0.50 0.20 270)",
  },
  {
    id: "violet",
    name: "紫罗兰",
    description: "优雅神秘，浪漫气质",
    previewColor: "oklch(0.55 0.20 290)",
  },
  {
    id: "fuchsia",
    name: "紫红色",
    description: "大胆妖艳，个性张扬",
    previewColor: "oklch(0.55 0.22 330)",
  },
  {
    id: "slate",
    name: "石板灰",
    description: "低调内敛，专注高效",
    previewColor: "oklch(0.45 0.02 250)",
  },
  {
    id: "zinc",
    name: "墨黑色",
    description: "极简纯粹，极致对比",
    previewColor: "oklch(0.20 0.00 0)",
  },

  // --- 混色/特殊系列 ---
  {
    id: "sunset",
    name: "日落",
    description: "紫橙渐变，浪漫晚霞",
    previewColor: "linear-gradient(135deg, oklch(0.60 0.18 300), oklch(0.70 0.18 50))",
  },
  {
    id: "aurora",
    name: "极光",
    description: "蓝绿交织，神秘清冷",
    previewColor: "linear-gradient(135deg, oklch(0.60 0.16 240), oklch(0.70 0.16 160))",
  },
  {
    id: "neon",
    name: "霓虹",
    description: "赛博朋克，青粉撞色",
    previewColor: "linear-gradient(135deg, oklch(0.60 0.18 190), oklch(0.60 0.22 330))",
  },
  {
    id: "gold",
    name: "黑金",
    description: "奢华质感，尊贵典雅",
    previewColor: "linear-gradient(135deg, oklch(0.60 0.16 85), oklch(0.30 0.02 85))",
  },
  {
    id: "prism",
    name: "棱镜",
    description: "全息光谱，流光溢彩",
    previewColor: "linear-gradient(135deg, #ff0000, #00ff00, #0000ff)",
  },
];

const STORAGE_KEY = "filecloud-color-theme";

/**
 * 颜色主题管理 Hook
 * 状态持久化在 localStorage，通过 data-color-theme 属性切换
 */
export function useColorTheme() {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    // 从 localStorage 读取初始值
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && COLOR_THEMES.some((t) => t.id === stored)) {
      return stored as ColorTheme;
    }
    return "ocean";
  });

  // 应用主题到 DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-color-theme", colorTheme);
    localStorage.setItem(STORAGE_KEY, colorTheme);
  }, [colorTheme]);

  // 初始化时也要应用
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && COLOR_THEMES.some((t) => t.id === stored)) {
      document.documentElement.setAttribute("data-color-theme", stored);
    }
  }, []);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
  }, []);

  const currentThemeInfo = COLOR_THEMES.find((t) => t.id === colorTheme) ?? COLOR_THEMES[0];

  return {
    colorTheme,
    setColorTheme,
    currentThemeInfo,
    themes: COLOR_THEMES,
  };
}
