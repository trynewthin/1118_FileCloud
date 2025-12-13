import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppBottomNav } from "@/components/layout/AppBottomNav";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext";
import { LayoutBackground } from "@/components/layout/LayoutBackground";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { useBlurTheme } from "@/hooks/useBlurTheme";
import { useButtonShape } from "@/hooks/useButtonShape";

const SIDEBAR_STATE_KEY = "filecloud_sidebar_collapsed";

/**
 * RootLayout 布局设计原则：
 * 
 * 为了让 backdrop-filter 正确工作，必须确保：
 * 1. LayoutBackground 是最底层（z-0）
 * 2. 所有使用 backdrop-filter 的元素（侧边栏、顶栏、工具栏等）直接叠在 LayoutBackground 上
 * 3. 不能有任何 overflow 容器包裹这些元素（overflow 会创建新的层叠上下文，阻断 backdrop-filter）
 * 
 * 布局结构：
 * - 根容器：fixed 全屏，无 overflow
 * - LayoutBackground：absolute z-0，背景层
 * - AppSidebar：直接在根容器中，能正确模糊背景
 * - 主内容区：flex 布局，不设 overflow
 *   - AppHeader：absolute 定位，能正确模糊背景
 *   - main：flex-1，不设 overflow，只负责布局
 *     - 页面内容（Outlet）：各页面自己管理滚动，滚动容器在最内层
 *   - AppBottomNav：固定在底部
 */
export function RootLayout() {
  // 确保应用初始化时根据存储的配置同步毛玻璃主题
  useBlurTheme();
  useButtonShape();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_STATE_KEY);
      return stored === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <PageHeaderProvider>
      {/* 根容器：fixed 全屏，不设 overflow，让 backdrop-filter 能穿透 */}
      <div className={cn("fixed inset-0", DS.layout.pageBackground)}>
        {/* 背景层：z-0 */}
        <LayoutBackground />

        {/* 内容层：z-10，flex 布局 */}
        <div className="absolute inset-0 z-10 flex">
          {/* 侧边栏：直接在这一层，能正确模糊背景 */}
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
          
          {/* 主内容区 */}
          <div className="relative flex flex-1 flex-col h-full min-w-0">
            {/* 顶栏：absolute 定位 */}
            <AppHeader />
            
            {/* 主内容：不设 overflow，让页面自己管理滚动；关闭页面切换动画 */}
            <main className={cn(
              "relative flex flex-1 h-full min-h-0 flex-col",
              DS.layout.mainContent,
              // 移动端底部导航适配
              "pb-[calc(4rem+env(safe-area-inset-bottom,20px))] md:pb-6"
            )}>
              <div className="relative flex flex-1 flex-col h-full min-h-0">
                <Outlet />
              </div>
            </main>
            
            {/* 底部导航 */}
            <AppBottomNav />
          </div>
        </div>
      </div>
    </PageHeaderProvider>
  );
}
