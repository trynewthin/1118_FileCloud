import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";

export function AppBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item, index) => {
          const isActive = item.match.test(location.pathname);
          return (
            <Link
              key={index}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
                isActive && "text-primary font-medium"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "fill-current")} />
              {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
