import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { DS } from "@/lib/design-system";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { config } = usePageHeader();

  const title = config.title ?? "FileCloud";

  return (
    // 修改定位策略：使用 absolute 定位于父容器（Main Area）的顶部
    // z-20 确保在内容之上
    <header className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-4 px-4 md:px-8 pointer-events-none">
      <div className={cn(
        // Header Bar 本体
        "pointer-events-auto h-14 flex items-center gap-4 px-2 pr-2 w-full",
        "border shadow-sm transition-all duration-300",
        DS.radius.full,
        DS.glass.strong
      )}>
        {/* Title Section */}
        <div className={cn("flex-1 md:flex-none pl-4 truncate", DS.text.heading)}>
          {title}
        </div>
        
        {/* Action Placeholder (Spacer) */}
        <div className="hidden md:block flex-1" />

        {/* 右侧操作区：页面级 actions、主题切换、用户菜单 */}
        <div className="flex items-center gap-2 pr-1">
          {config.actions && <div className="flex items-center gap-1 mr-2">{config.actions}</div>}

          {/* 主题切换按钮：放在用户按钮左侧，尺寸与用户头像内圈统一为 8x8 */}
          <AnimatedThemeToggler
            className={cn(
              "flex items-center justify-center h-8 w-8 transition-all [&>svg]:h-4 [&>svg]:w-4",
              DS.radius.full,
              // 与用户按钮的内圈风格保持一致：primary 语义色
              "bg-primary/5 text-primary hover:bg-primary/10 border border-primary/10 shadow-sm"
            )}
            aria-label="切换主题"
          />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-9 w-9 transition-all hover:bg-primary/10",
                    DS.radius.full
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 text-primary shadow-sm border border-primary/10">
                    <User className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={DS.radius.lg}>
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate max-w-[150px]">
                  {user.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
