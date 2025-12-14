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
import { AnimatedThemeToggler } from "@/components/layout/header/animated-theme-toggler";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";
import { GlassButtonGroup } from "@/components/common/button/GlassButtonGroup";
import { GlassIconButton } from "@/components/common/button/GlassButton";

interface GlobalHeaderActionsProps {
  className?: string;
}

export function GlobalHeaderActions({ className }: GlobalHeaderActionsProps) {
  const { user, logout } = useAuth();

  return (
    <GlassButtonGroup
      glassVariant="lite"
      wrapNonIconChildren={false}
      className={cn("py-0", className)}
    >
      <AnimatedThemeToggler
        title="切换主题"
        aria-label="切换主题"
        className="h-7! w-7! rounded-full button-rect:rounded-md"
      />

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <GlassIconButton
              type="button"
              glassVariant="lite"
              title="用户菜单"
              className="h-7! w-7! rounded-full button-rect:rounded-md"
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
    </GlassButtonGroup>
  );
}
