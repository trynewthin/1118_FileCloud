import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";
import { Button } from "@/components/ui/button";
import { PanelLeft, PanelLeftOpen } from "lucide-react";

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function AppSidebar({ collapsed = false, onToggleSidebar }: AppSidebarProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "hidden md:flex flex-col text-card-foreground transition-all duration-200",
        "m-4 h-[calc(100vh-2rem)] rounded-2xl border bg-card/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-2 font-bold text-lg", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && <div className="px-2">FileCloud</div>}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onToggleSidebar}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {navItems.map((item, index) => {
            const isActive = item.match.test(location.pathname);
            return (
              <Button
                key={index}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "gap-2",
                  collapsed ? "justify-center px-0" : "justify-start",
                  isActive && "bg-secondary"
                )}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="h-5 w-5" />
                  {!collapsed && <span className="ml-2">{item.title}</span>}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4">
        {!collapsed && (
          <div className="text-xs text-muted-foreground text-center">v1.0.0</div>
        )}
      </div>
    </div>
  );
}
