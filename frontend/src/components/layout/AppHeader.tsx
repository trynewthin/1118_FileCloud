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
import { usePageHeader } from "@/components/layout/PageHeaderContext";

export function AppHeader() {
  const { user, logout } = useAuth();
  const { config } = usePageHeader();

  const title = config.title ?? "FileCloud";

  return (
    <header className="pointer-events-none relative z-10 flex h-0 items-start justify-center">
      <div className="pointer-events-auto mt-4 w-full px-4 md:px-6">
        <div className="flex h-12 items-center gap-3 rounded-full border bg-background/80 px-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="font-semibold text-sm truncate flex-1 md:flex-none pl-2">{title}</div>
          <div className="hidden md:block flex-1" />

          <div className="flex items-center gap-2">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="h-4 w-4" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                  <DropdownMenuLabel className="font-normal text-xs text-muted-foreground truncate max-w-[150px]">
                    {user.username}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
