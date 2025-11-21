import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const location = useLocation();

  return (
    <div className="hidden w-64 flex-col border-r bg-card text-card-foreground md:flex">
      <div className="flex h-14 items-center border-b px-6 font-bold text-lg">
        FileCloud
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
                  "justify-start gap-2",
                  isActive && "bg-secondary"
                )}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground text-center">
          v1.0.0
        </div>
      </div>
    </div>
  );
}
