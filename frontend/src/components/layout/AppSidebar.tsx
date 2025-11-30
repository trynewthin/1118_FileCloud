import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";
import { Button } from "@/components/ui/button";
import { PanelLeft, PanelLeftOpen } from "lucide-react";
import { DS } from "@/lib/design-system";

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function AppSidebar({ collapsed = false, onToggleSidebar }: AppSidebarProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "hidden md:flex flex-col text-card-foreground transition-all duration-300 ease-out",
        "m-4 h-[calc(100vh-2rem)] border",
        DS.radius.xl,
        DS.glass.strong,
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* Header Area */}
      <div className={cn(
        "flex h-16 items-center border-b border-border/40 px-3", 
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <div className={cn("px-2 text-lg", DS.text.heading)}>
            FileCloud
          </div>
        )}
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8", 
              DS.radius.full,
              "text-muted-foreground hover:text-foreground"
            )}
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

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="grid gap-1.5">
          {navItems.map((item, index) => {
            const isActive = item.match.test(location.pathname);
            return (
              <Button
                key={index}
                variant="ghost"
                className={cn(
                  "group relative h-11 transition-all duration-200",
                  collapsed ? "justify-center px-0 w-11 mx-auto" : "justify-start px-3 w-full",
                  DS.radius.lg,
                  isActive 
                    ? "bg-primary/5 font-medium" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                asChild
              >
                <Link to={item.href}>
                  <div className={cn(
                    "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-300",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm scale-105" 
                      : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  {!collapsed && (
                    <span className={cn(
                      "ml-3 text-sm transition-colors",
                      isActive ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                      {item.title}
                    </span>
                  )}
                  
                  {/* Active Indicator for Collapsed Mode - Optional, can be removed if icon style is enough */}
                  {collapsed && isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 h-8 w-1 rounded-r-full bg-primary opacity-0" /> 
                  )}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="border-t border-border/40 p-4">
        {!collapsed && (
          <div className={cn("text-center", DS.text.caption)}>
            v1.0.0
          </div>
        )}
      </div>
    </div>
  );
}
