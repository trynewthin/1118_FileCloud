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
import { AnimatedThemeToggler } from "@/components/settings/animated-theme-toggler";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassIconButton } from "@/components/common/GlassButton";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { config } = usePageHeader();

  const title = config.title ?? "FileCloud";

  return (
    // 修改定位策略：使用 absolute 定位于父容器（Main Area）的顶部
    // z-20 确保在内容之上
    <header className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-[calc(1rem+env(safe-area-inset-top))] px-4 md:pl-0 md:pr-8 pointer-events-none">
      <GlassCard
        variant="strong"
        className={cn(
          // Header Bar 本体
          "pointer-events-auto h-14 flex items-center gap-4 px-2 pr-2 w-full md:max-w-5xl",
          "transition-all duration-300"
        )}
      >
        {/* Title Section */}
        <div className={cn("flex-1 md:flex-none pl-4 truncate min-w-0 md:max-w-[300px]", DS.text.heading)}>
          {title}
        </div>
        
        {/* Action Placeholder (Spacer) */}
        <div className="hidden md:block flex-1" />

        {/* 右侧操作区：页面级 actions、主题切换、用户菜单 */}
        <div className="flex items-center gap-2 pr-1">
          {config.actions && <div className="flex items-center gap-1 mr-2">{config.actions}</div>}

          {/* 主题切换按钮：放在用户按钮左侧，尺寸与用户头像内圈统一为 8x8 */}
          <AnimatedThemeToggler
            className="transition-all hover:bg-primary/10"
            title="切换主题"
            aria-label="切换主题"
          />

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <GlassIconButton
                  type="button"
                  glassVariant="lite"
                  className="transition-all hover:bg-primary/10"
                  title="用户菜单"
                >
                  <User className="h-4 w-4" />
                </GlassIconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className={cn(DS.radius.lg, DS.glass.strong, "border-white/10 min-w-[180px] p-1")}
              >
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
      </GlassCard>
    </header>
  );
}
