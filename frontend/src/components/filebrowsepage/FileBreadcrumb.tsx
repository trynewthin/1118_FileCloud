import { useEffect, useRef } from "react";
import { Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// 面包屑项类型
// ============================================================================
export interface BreadcrumbItem {
  id: string;
  name: string;
}

// ============================================================================
// FileBreadcrumb Props - 纯面包屑组件
// ============================================================================
interface FileBreadcrumbProps {
  items: BreadcrumbItem[];
  onRootClick: () => void;
  onItemClick: (item: BreadcrumbItem, index: number) => void;
  className?: string;
}

// ============================================================================
// FileBreadcrumb 组件 - 纯面包屑导航
// ============================================================================
export function FileBreadcrumb({
  items,
  onRootClick,
  onItemClick,
  className,
}: FileBreadcrumbProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 面包屑变化时自动滚动到最右侧
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
  }, [items.length]);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* 左侧固定 Home 图标 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1 hover:bg-transparent hover:text-foreground shrink-0"
        onClick={onRootClick}
      >
        <Home className="h-4 w-4" />
      </Button>

      {/* 中间：可横向滚动的路径部分 */}
      <div
        ref={scrollRef}
        className="flex-1 min-w-0 overflow-x-auto scrollbar-thin pr-1"
      >
        <nav className="flex items-center text-sm text-muted-foreground min-w-fit">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center min-w-0">
              <ChevronRight className="h-4 w-4 mx-0.5 shrink-0 opacity-50" />
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-auto p-1 hover:bg-transparent hover:text-foreground font-normal truncate max-w-[140px] md:max-w-[220px]",
                  index === items.length - 1 && "font-medium text-foreground pointer-events-none"
                )}
                onClick={() => onItemClick(item, index)}
                title={item.name}
              >
                {item.name}
              </Button>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
