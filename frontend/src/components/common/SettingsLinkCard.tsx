import type { FC, ReactNode } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsLinkCardProps {
  title: string;
  description?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export const SettingsLinkCard: FC<SettingsLinkCardProps> = ({
  title,
  description,
  onClick,
  className,
}) => {
  return (
    <GlassCard
      variant="lite"
      className={cn(
        "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
        // classic：更克制；mac：更强调
        "hover:bg-accent/30 blur-mac:hover:bg-primary/5",
        className,
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </GlassCard>
  );
};
