import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";
import { PanelLeft, PanelLeftOpen } from "lucide-react";
import { DS } from "@/theme/design-system";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton, GlassIconButton } from "@/components/common/GlassButton";

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function AppSidebar({ collapsed = false, onToggleSidebar }: AppSidebarProps) {
  const location = useLocation();

  return (
    <GlassCard
      variant="strong"
      className={cn(
        "hidden md:flex flex-col text-card-foreground transition-all duration-300 ease-out",
        "m-4 h-[calc(100vh-2rem)]",
        collapsed ? "w-[72px]" : "w-56"
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
          <GlassIconButton
            type="button"
            glassVariant="lite"
            className="h-8! w-8! text-muted-foreground hover:text-foreground"
            onClick={onToggleSidebar}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </GlassIconButton>
        )}
      </div>

      {/* Navigation Area */}
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="grid gap-1.5">
          {navItems.map((item, index) => {
            const isActive = item.match.test(location.pathname);
            return (
              <GlassButton
                key={index}
                variant="ghost"
                glassVariant={collapsed ? "ghost" : isActive ? "lite" : "ghost"}
                className={cn(
                  "group relative h-11 transition-all duration-200",
                  collapsed ? "justify-center px-0 w-11 mx-auto" : "justify-start px-2.5 w-full",
                  // 统一圆角规范（与全局玻璃卡片/按钮一致）
                  cn(DS.radius.xl, "button-rect:rounded-xl"),
                  // 文字颜色与 hover
                  isActive ? "font-medium" : "text-muted-foreground hover:text-foreground",
                  // 折叠态不显示外层玻璃/边缘，避免样式啰嗦：只保留图标容器高亮
                  collapsed && "bg-transparent hover:bg-transparent shadow-none hover:shadow-none"
                )}
                asChild
              >
                <Link to={item.href}>
                  <div className={cn(
                    "shrink-0 h-8 w-8 flex items-center justify-center transition-all duration-200",
                    // 图标容器也遵循玻璃/圆角
                    cn(DS.radius.full, "button-rect:rounded-xl"),
                    DS.glass.lite,
                    "border border-border/20 shadow-sm",
                    isActive
                      ? "bg-background/80 text-foreground"
                      : "bg-transparent text-muted-foreground group-hover:bg-background/70 group-hover:text-foreground"
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  {!collapsed && (
                    <span className={cn(
                      "ml-3 text-sm transition-colors",
                      isActive ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
                    )}>
                      {item.title}
                    </span>
                  )}
                  
                  {/* Active Indicator for Collapsed Mode - Optional, can be removed if icon style is enough */}
                  {collapsed && isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 h-8 w-1 rounded-r-full bg-primary opacity-0" /> 
                  )}
                </Link>
              </GlassButton>
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
    </GlassCard>
  );
}
