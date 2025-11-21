import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppBottomNav } from "@/components/layout/AppBottomNav";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext";

const SIDEBAR_STATE_KEY = "filecloud_sidebar_collapsed";

export function RootLayout() {
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
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
        <div className="flex flex-1 flex-col h-full min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-background px-4 md:px-6 pt-20 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-6">
            <Outlet />
          </main>
          <AppBottomNav />
        </div>
      </div>
    </PageHeaderProvider>
  );
}
