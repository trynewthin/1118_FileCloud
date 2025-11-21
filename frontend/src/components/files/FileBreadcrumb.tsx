import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface FileBreadcrumbProps {
  items: BreadcrumbItem[];
  onRootClick: () => void;
  onItemClick: (item: BreadcrumbItem, index: number) => void;
  className?: string;
}

export function FileBreadcrumb({
  items,
  onRootClick,
  onItemClick,
  className,
}: FileBreadcrumbProps) {
  return (
    <nav className={cn("flex items-center text-sm text-muted-foreground", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-1 hover:bg-transparent hover:text-foreground"
        onClick={onRootClick}
      >
        <Home className="h-4 w-4" />
      </Button>
      
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-auto p-1 hover:bg-transparent hover:text-foreground font-normal",
              index === items.length - 1 && "font-medium text-foreground pointer-events-none"
            )}
            onClick={() => onItemClick(item, index)}
          >
            {item.name}
          </Button>
        </div>
      ))}
    </nav>
  );
}
