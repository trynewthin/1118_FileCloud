import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface PageScrollContentProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 是否移除默认的内边距微调
   * 默认为 false，会添加 px-1 以防止内容贴近滚动条
   */
  noPadding?: boolean;
}

/**
 * 页面级滚动容器
 * 用于在 PageContainer 内部创建一个标准化的滚动区域
 * 
 * 解决了直接使用 div + overflow-y-auto 导致的重复代码和样式不一致问题
 * 默认包含 px-1 微调，防止滚动条过于贴近内容
 */
export function PageScrollContent({ 
  children, 
  className, 
  noPadding = false,
  ...props 
}: PageScrollContentProps) {
  return (
    <div 
      className={cn(
        // 基础布局：占据剩余空间，处理溢出
        "flex-1 min-h-0 overflow-y-auto",
        // 视觉优化：添加微小内边距避免滚动条贴死内容
        // PageContainer 本身已有 px-2，这里的 px-1 是为了让滚动条和内部卡片之间有呼吸感
        !noPadding && "px-1",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}
