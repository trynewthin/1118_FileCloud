import { cn } from "@/lib/utils";

/**
 * FileCloud Design System
 * 统一管理 UI 的核心视觉风格：圆角、阴影、玻璃拟态、卡片层级等
 */

export const DS = {
  // 1. 布局与容器
  layout: {
    // 页面主背景：浅灰色底，深色模式下为深灰，避免纯黑白的刺眼
    pageBackground: "bg-zinc-50/50 dark:bg-zinc-950",
    // 主内容区的内边距策略
    mainContent: "px-4 md:px-8 pt-20 pb-6",
  },

  // 2. 圆角系统 (Radius)
  radius: {
    // 只有在极小的元素（如 checkbox）使用
    sm: "rounded-md", 
    // 通用组件（按钮、输入框）
    md: "rounded-lg",
    // 卡片、对话框
    lg: "rounded-xl",
    // 侧边栏、大容器、浮窗
    xl: "rounded-2xl",
    // 胶囊按钮、头像
    full: "rounded-full",
  },

  // 3. 玻璃拟态与背景 (Glass & Surface)
  glass: {
    // 强模糊（侧边栏、顶栏）：高透 + 强模糊 + 细边框
    strong: "bg-background/70 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-sm supports-[backdrop-filter]:bg-background/60",
    // 弱模糊（内容区的浮层）：低透 + 弱模糊
    lite: "bg-background/50 backdrop-blur-md border-white/10 shadow-sm",
    // 纯卡片（不透明）：用于正文内容
    card: "bg-card text-card-foreground border border-border/40 shadow-sm",
  },

  // 4. 交互与动效 (Interaction)
  interactive: {
    // 通用 Hover 效果：轻微上浮 + 阴影加深
    hoverCard: "transition-all duration-300 hover:shadow-md hover:-translate-y-[1px]",
    // 按钮点击缩放反馈
    activePress: "active:scale-95 transition-transform",
  },

  // 5. 文本与排版
  text: {
    heading: "font-semibold tracking-tight text-foreground",
    subheading: "text-sm font-medium text-muted-foreground",
    body: "text-sm text-foreground/90 leading-relaxed",
    caption: "text-xs text-muted-foreground/80",
  },

  // 6. 氛围光效 (Glow & Ambient)
  glow: {
    // 主色调光斑：适合放在页面角落
    primary: "absolute w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none dark:bg-primary/5",
    // 冷色调光斑：蓝色系
    cool: "absolute w-[400px] h-[400px] rounded-full bg-blue-400/10 blur-[100px] pointer-events-none dark:bg-blue-500/10",
    // 暖色调光斑：橙/紫色系
    warm: "absolute w-[600px] h-[600px] rounded-full bg-orange-300/10 blur-[130px] pointer-events-none dark:bg-purple-500/10",
  },

  // 7. 辅助工具函数
  utils: {
    // 生成统一的 Sidebar 容器样式
    sidebar: (collapsed: boolean) => cn(
      "transition-all duration-300 ease-in-out border",
      "fixed left-4 top-4 bottom-4 z-30", // 悬浮式设计
      DS.radius.xl,
      DS.glass.strong,
      collapsed ? "w-[72px]" : "w-72"
    ),
    // 生成统一的 Header 容器样式
    header: () => cn(
      "fixed top-4 left-0 right-0 z-20 flex justify-center pointer-events-none",
      "px-4 md:px-8"
    ),
    // Header 内部的内容条
    headerBar: () => cn(
      "pointer-events-auto h-14 flex items-center gap-4 px-2 pr-2",
      "border shadow-sm transition-all duration-300",
      DS.radius.full,
      DS.glass.strong,
      "w-full md:max-w-5xl" // 限制最大宽度，更有高级感
    )
  }
} as const;
