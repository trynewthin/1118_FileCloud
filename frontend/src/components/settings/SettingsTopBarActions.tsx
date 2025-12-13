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
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";
import { GlassIconButton } from "@/components/common/GlassButton";

interface SettingsTopBarActionsProps {
  className?: string;
}

export function SettingsTopBarActions({ className }: SettingsTopBarActionsProps) {
  const { user, logout } = useAuth();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 主题切换 */}
      <AnimatedThemeToggler
        className="transition-all hover:bg-primary/10"
        title="切换主题"
        aria-label="切换主题"
      />

      {/* 用户菜单 */}
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
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
