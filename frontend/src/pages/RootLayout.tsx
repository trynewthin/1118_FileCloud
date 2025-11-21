import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppBottomNav } from "@/components/layout/AppBottomNav";

export function RootLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col h-full min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
        <AppBottomNav />
      </div>
    </div>
  );
}
