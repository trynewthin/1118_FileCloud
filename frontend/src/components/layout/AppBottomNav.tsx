import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";
import { DS } from "@/lib/design-system";

export function AppBottomNav() {
  const location = useLocation();
  const [lastBrowsePath, setLastBrowsePath] = useState<string>("/files");

  // 记录最近一次在“浏览”域（/files 或 /preview）中的路径
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/files") || path.startsWith("/preview")) {
      const fullPath = location.search ? `${path}${location.search}` : path;
      setLastBrowsePath(fullPath);
    }
  }, [location.pathname, location.search]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
      <div className="pointer-events-auto mx-auto mb-5 px-4">
        <div
          className={cn(
            "flex h-16 items-center justify-around px-4 border shadow-sm",
            DS.radius.full,
            DS.glass.strong,
            "bg-background/80"
          )}
        >
          {navItems.map((item, index) => {
            const isActive = item.match.test(location.pathname);
            const isBrowseItem = item.href === "/files";
            const targetHref = isBrowseItem ? lastBrowsePath : item.href;
            return (
              <Link
                key={index}
                to={targetHref}
                className={cn(
                  "group flex flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground transition-all",
                  isActive && "text-primary font-medium"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full transition-all duration-300",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "bg-muted/40 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "leading-none",
                    isActive ? "text-primary" : "text-muted-foreground/80"
                  )}
                >
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
