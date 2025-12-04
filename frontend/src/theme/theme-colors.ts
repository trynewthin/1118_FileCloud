/**
 * FileCloud 主题颜色配置
 * 
 * 使用 OKLCH 色彩空间，提供更好的感知均匀性
 * 每个主题包含完整的浅色和深色模式配置
 */

export interface ThemeColors {
  name: string;
  displayName: string;
  light: ColorScheme;
  dark: ColorScheme;
}

export interface ColorScheme {
  // 基础背景色
  background: string;
  foreground: string;
  
  // 卡片
  card: string;
  cardForeground: string;
  
  // 弹出层
  popover: string;
  popoverForeground: string;
  
  // 主色调 - 品牌色，用于主要按钮、链接、强调
  primary: string;
  primaryForeground: string;
  
  // 次要色 - 次要按钮、标签
  secondary: string;
  secondaryForeground: string;
  
  // 静音色 - 禁用状态、占位符
  muted: string;
  mutedForeground: string;
  
  // 强调色 - hover 状态、选中背景
  accent: string;
  accentForeground: string;
  
  // 危险色 - 删除、错误
  destructive: string;
  destructiveForeground: string;
  
  // 成功色
  success: string;
  successForeground: string;
  
  // 警告色
  warning: string;
  warningForeground: string;
  
  // 信息色
  info: string;
  infoForeground: string;
  
  // 边框和输入框
  border: string;
  input: string;
  ring: string;
  
  // 图表颜色
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  
  // 侧边栏
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

/**
 * 默认主题 - Ocean Blue
 * 
 * 设计理念：
 * - 浅色模式：干净、通透的现代风格。背景使用极淡的中性灰，卡片纯白，主色调为深邃的宝石蓝。
 * - 深色模式：深沉的矿石灰背景，避免纯黑的生硬，主色调适当提亮以确保可读性。
 * - 整体去蓝化：次要元素（Secondary/Muted）回归中性灰，避免界面"一片蓝"的廉价感。
 */
export const defaultTheme: ThemeColors = {
  name: "ocean-blue",
  displayName: "海洋蓝",
  light: {
    // 背景：极淡的冷灰色，几乎接近纯白，显得干净
    background: "oklch(0.985 0.002 240)",
    foreground: "oklch(0.20 0.01 240)",
    
    // 卡片：纯白，利用阴影和边框区分层级
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.20 0.01 240)",
    
    // 弹出层
    popover: "oklch(1 0 0)",
    popoverForeground: "oklch(0.20 0.01 240)",
    
    // 主色调：深邃的宝石蓝 (Sapphire Blue)，稳重且高级
    primary: "oklch(0.50 0.18 255)",
    primaryForeground: "oklch(0.98 0 0)",
    
    // 次要色：中性浅灰，不带色相，作为衬托
    secondary: "oklch(0.96 0 0)",
    secondaryForeground: "oklch(0.20 0.01 240)",
    
    // 静音色：中性灰
    muted: "oklch(0.96 0 0)",
    mutedForeground: "oklch(0.55 0 0)",
    
    // 强调色：极淡的品牌色背景，用于 hover 状态
    accent: "oklch(0.96 0.01 255)",
    accentForeground: "oklch(0.20 0.01 240)",
    
    // 危险色：标准的红
    destructive: "oklch(0.60 0.18 25)",
    destructiveForeground: "oklch(0.98 0 0)",
    
    // 成功色：翡翠绿
    success: "oklch(0.65 0.18 150)",
    successForeground: "oklch(0.98 0 0)",
    
    // 警告色：暖橙
    warning: "oklch(0.80 0.15 70)",
    warningForeground: "oklch(0.20 0.02 70)",
    
    // 信息色：蔚蓝
    info: "oklch(0.65 0.15 240)",
    infoForeground: "oklch(0.98 0 0)",
    
    // 边框：浅中性灰
    border: "oklch(0.92 0 0)",
    input: "oklch(0.92 0 0)",
    ring: "oklch(0.50 0.18 255)",
    
    // 图表颜色：多彩配色，便于区分数据
    chart1: "oklch(0.50 0.18 255)", // 蓝
    chart2: "oklch(0.65 0.18 150)", // 绿
    chart3: "oklch(0.75 0.15 50)",  // 橙
    chart4: "oklch(0.60 0.20 300)", // 紫
    chart5: "oklch(0.65 0.18 25)",  // 红
    
    // 侧边栏：略微深一点的浅灰，与主内容区形成微妙对比
    sidebar: "oklch(0.98 0.002 240)",
    sidebarForeground: "oklch(0.30 0.01 240)",
    sidebarPrimary: "oklch(0.50 0.18 255)",
    sidebarPrimaryForeground: "oklch(0.98 0 0)",
    sidebarAccent: "oklch(0.95 0.01 255)",
    sidebarAccentForeground: "oklch(0.20 0.01 240)",
    sidebarBorder: "oklch(0.92 0 0)",
    sidebarRing: "oklch(0.50 0.18 255)",
  },
  dark: {
    // 背景：深沉的矿石灰 (Slate/Mineral Gray)
    background: "oklch(0.15 0.01 240)",
    foreground: "oklch(0.98 0 0)",
    
    // 卡片：比背景稍亮
    card: "oklch(0.18 0.01 240)",
    cardForeground: "oklch(0.98 0 0)",
    
    // 弹出层
    popover: "oklch(0.18 0.01 240)",
    popoverForeground: "oklch(0.98 0 0)",
    
    // 主色调：提亮一点的蓝紫色
    primary: "oklch(0.65 0.18 255)",
    primaryForeground: "oklch(0.15 0.01 240)",
    
    // 次要色：深灰
    secondary: "oklch(0.25 0.01 240)",
    secondaryForeground: "oklch(0.98 0 0)",
    
    // 静音色
    muted: "oklch(0.25 0.01 240)",
    mutedForeground: "oklch(0.65 0 0)",
    
    // 强调色：深蓝灰背景
    accent: "oklch(0.25 0.02 255)",
    accentForeground: "oklch(0.98 0 0)",
    
    // 危险色
    destructive: "oklch(0.65 0.20 25)",
    destructiveForeground: "oklch(0.98 0 0)",
    
    // 成功色
    success: "oklch(0.70 0.15 150)",
    successForeground: "oklch(0.15 0.01 240)",
    
    // 警告色
    warning: "oklch(0.80 0.15 70)",
    warningForeground: "oklch(0.15 0.01 240)",
    
    // 信息色
    info: "oklch(0.70 0.15 240)",
    infoForeground: "oklch(0.15 0.01 240)",
    
    // 边框
    border: "oklch(1 0 0 / 12%)",
    input: "oklch(1 0 0 / 12%)",
    ring: "oklch(0.65 0.18 255)",
    
    // 图表颜色
    chart1: "oklch(0.65 0.18 255)",
    chart2: "oklch(0.70 0.15 150)",
    chart3: "oklch(0.75 0.15 50)",
    chart4: "oklch(0.65 0.20 300)",
    chart5: "oklch(0.70 0.18 25)",
    
    // 侧边栏：比主背景略深或略浅均可，这里选择略深增加沉浸感
    sidebar: "oklch(0.13 0.01 240)",
    sidebarForeground: "oklch(0.90 0 0)",
    sidebarPrimary: "oklch(0.65 0.18 255)",
    sidebarPrimaryForeground: "oklch(0.98 0 0)",
    sidebarAccent: "oklch(0.25 0.02 255)",
    sidebarAccentForeground: "oklch(0.98 0 0)",
    sidebarBorder: "oklch(1 0 0 / 8%)",
    sidebarRing: "oklch(0.65 0.18 255)",
  },
};

/**
 * 将主题颜色转换为 CSS 变量字符串
 */
export function generateCSSVariables(colors: ColorScheme): string {
  return `
  --background: ${colors.background};
  --foreground: ${colors.foreground};
  --card: ${colors.card};
  --card-foreground: ${colors.cardForeground};
  --popover: ${colors.popover};
  --popover-foreground: ${colors.popoverForeground};
  --primary: ${colors.primary};
  --primary-foreground: ${colors.primaryForeground};
  --secondary: ${colors.secondary};
  --secondary-foreground: ${colors.secondaryForeground};
  --muted: ${colors.muted};
  --muted-foreground: ${colors.mutedForeground};
  --accent: ${colors.accent};
  --accent-foreground: ${colors.accentForeground};
  --destructive: ${colors.destructive};
  --destructive-foreground: ${colors.destructiveForeground};
  --success: ${colors.success};
  --success-foreground: ${colors.successForeground};
  --warning: ${colors.warning};
  --warning-foreground: ${colors.warningForeground};
  --info: ${colors.info};
  --info-foreground: ${colors.infoForeground};
  --border: ${colors.border};
  --input: ${colors.input};
  --ring: ${colors.ring};
  --chart-1: ${colors.chart1};
  --chart-2: ${colors.chart2};
  --chart-3: ${colors.chart3};
  --chart-4: ${colors.chart4};
  --chart-5: ${colors.chart5};
  --sidebar: ${colors.sidebar};
  --sidebar-foreground: ${colors.sidebarForeground};
  --sidebar-primary: ${colors.sidebarPrimary};
  --sidebar-primary-foreground: ${colors.sidebarPrimaryForeground};
  --sidebar-accent: ${colors.sidebarAccent};
  --sidebar-accent-foreground: ${colors.sidebarAccentForeground};
  --sidebar-border: ${colors.sidebarBorder};
  --sidebar-ring: ${colors.sidebarRing};
  `.trim();
}

// 当前激活的主题
export const activeTheme = defaultTheme;
