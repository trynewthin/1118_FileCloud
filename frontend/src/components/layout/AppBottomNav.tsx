import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { navItems } from "@/configs/nav";
import { DS } from "@/theme/design-system";

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
                  "group relative flex h-full flex-col items-center justify-end pb-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl",
                  isActive ? "w-20" : "w-10"
                )}
              >
                <div
                  className={cn(
                    "absolute left-1/2 top-1/2 flex -translate-x-1/2 items-center justify-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                    isActive
                      ? "h-15 w-15 -translate-y-[80%] bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                      : "h-10 w-10 -translate-y-1/2 bg-transparent text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  )}
                >
                  <item.icon
                    className={cn(
                      "transition-all duration-500",
                      isActive ? "h-8 w-8" : "h-6 w-6"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none transition-all duration-500",
                    isActive
                      ? "translate-y-0 opacity-100 text-primary"
                      : "translate-y-4 opacity-0"
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
