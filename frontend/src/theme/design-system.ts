import { cn } from "@/lib/utils";

/**
 * FileCloud Design System
 * 统一管理 UI 的核心视觉风格：圆角、阴影、玻璃拟态、卡片层级等
 * 
 * 颜色配置已移至 theme-colors.ts，通过 CSS 变量在 index.css 中定义
 */

export const DS = {
  // 1. 布局与容器
  layout: {
    // 页面主背景：使用主题变量
    pageBackground: "bg-background",
    // 主内容区的内边距策略
    mainContent: "px-4 md:px-8 pt-[calc(5rem+env(safe-area-inset-top))] pb-6",
    // PageContainer 内部内容区域：负责撑满高度并预留统一底部留白
    // 注意：不要使用 z-10，否则会创建新的层叠上下文，导致 backdrop-filter 无法模糊外部背景
    pageBody: "relative flex-1 min-h-0 h-full flex flex-col pb-4 md:pb-6 px-2 md:px-3",
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
  // 注意：backdrop-filter 在嵌套的 overflow 容器中无法穿透到外部背景
  // 因此在 main 滚动区内部的元素，backdrop-filter 只能模糊同层级的内容
  // 为了保证视觉一致性，使用较高的背景透明度 + 边框 + 阴影来模拟玻璃效果
  glass: {
    // 强模糊（侧边栏、顶栏等不在滚动容器内的元素）
    strong: [
      "border bg-background/70 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-sm supports-[backdrop-filter]:bg-background/60",
      // macOS 风格
      "blur-mac:bg-background/25",
      "blur-mac:backdrop-blur-2xl",
      "blur-mac:backdrop-saturate-150",
      "blur-mac:backdrop-contrast-125",
      "blur-mac:border-white/30",
      "blur-mac:dark:border-white/15",
      "blur-mac:shadow-md",
      "blur-mac:supports-[backdrop-filter]:bg-background/10",
    ].join(" "),
    // lite 目前作为 strong 的视觉别名，保证所有使用 lite 的地方与 strong 一致
    lite: [
      "border bg-background/70 backdrop-blur-xl border-white/20 dark:border-white/10 shadow-sm supports-[backdrop-filter]:bg-background/60",
      // macOS 风格
      "blur-mac:bg-background/25",
      "blur-mac:backdrop-blur-2xl",
      "blur-mac:backdrop-saturate-150",
      "blur-mac:backdrop-contrast-125",
      "blur-mac:border-white/30",
      "blur-mac:dark:border-white/15",
      "blur-mac:shadow-md",
      "blur-mac:supports-[backdrop-filter]:bg-background/10",
    ].join(" "),
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
  // 设计原则：文字统一使用 text-foreground（黑/白），通过字重区分主次，保证可读性
  // 只在极少数提示性场景（placeholder、空状态）使用 text-muted-foreground
  text: {
    // 标题：粗体
    heading: "font-semibold tracking-tight text-foreground",
    // 副标题：中等字重，正常颜色
    subheading: "text-sm font-medium text-foreground",
    // 正文：正常字重
    body: "text-sm text-foreground leading-relaxed",
    // 辅助说明：小字号 + 稍轻字重，仍用前景色保证可读
    caption: "text-xs font-normal text-foreground/70",
    // 仅用于 placeholder、空状态等极弱提示
    muted: "text-muted-foreground",
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
