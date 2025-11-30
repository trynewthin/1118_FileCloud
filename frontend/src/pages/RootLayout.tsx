import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppBottomNav } from "@/components/layout/AppBottomNav";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext";
import { DS } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { AmbientGlow } from "@/components/common/AmbientGlow";
import { useUiCompat } from "@/hooks/useUiCompat";

const SIDEBAR_STATE_KEY = "filecloud_sidebar_collapsed";

export function RootLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_STATE_KEY);
      return stored === "true";
    }
    return false;
  });

  // UI 兼容模式：用于关闭背景动画等效果，解决部分设备闪烁问题
  const { compatMode } = useUiCompat();

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
      <div className={cn("flex h-screen w-screen overflow-hidden relative", DS.layout.pageBackground)}>
        {/* Global Ambient Glow */}
        <AmbientGlow
          position="top-right"
          variant="primary"
          compatMode={compatMode}
          className="pointer-events-none fixed z-0"
        />
        <AmbientGlow
          position="bottom-left"
          variant="cool"
          compatMode={compatMode}
          className="pointer-events-none fixed z-0"
        />

        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
        <div className="relative flex flex-1 flex-col h-full min-w-0 z-10">
          <AppHeader />
          <main className={cn(
            "flex flex-1 h-full min-h-0 flex-col overflow-y-auto",
            DS.layout.mainContent,
            // 移动端底部导航适配
            "pb-[calc(4rem+env(safe-area-inset-bottom,20px))] md:pb-6"
          )}>
            <Outlet />
          </main>
          <AppBottomNav />
        </div>
      </div>
    </PageHeaderProvider>
  );
}
