import { useEffect } from "react";
import type { ComponentType } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { IconLabelItem } from "@/components/common/item/IconLabelItem";
import { navItems } from "@/configs/nav";

interface FolderGridMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lastBrowsePath: string;
  anchorRect?: Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height"> | null;
}

export function FolderGridMenu({ open, onOpenChange, lastBrowsePath, anchorRect }: FolderGridMenuProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onOpenChange(false);
  };

  const menuMaxWidth = 280;
  const viewportPadding = 8;
  const fallbackTop = 96;
  const fallbackLeft = viewportPadding;

  const top = anchorRect ? Math.round(anchorRect.bottom + 10) : fallbackTop;
  const left = anchorRect
    ? Math.min(
        Math.max(viewportPadding, Math.round(anchorRect.left)),
        Math.max(viewportPadding, window.innerWidth - menuMaxWidth - viewportPadding)
      )
    : fallbackLeft;

  const content = (
    <div className="fixed inset-0 z-60">
      <div
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />

      <div className="fixed" style={{ top, left, width: `min(${menuMaxWidth}px, calc(100vw - ${viewportPadding * 2}px))` }}>
        <GlassCard
          variant="strong"
          className={cn(
            "w-full",
            "p-1.5",
            "shadow-[0_16px_50px_rgba(0,0,0,0.35)]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-3 gap-x-1 gap-y-1 p-1 py-1.5">
            {navItems.map((item) => {
              const href = item.href === "/files" ? lastBrowsePath : item.href;
              return (
                <MenuItem
                  key={item.href}
                  title={item.title}
                  icon={item.icon}
                  onClick={() => go(href)}
                />
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function MenuItem({
  title,
  icon: Icon,
  onClick,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <IconLabelItem
      label={title}
      icon={<Icon className="h-5.5 w-5.5" />}
      onClick={onClick}
      glassVariant="strong"
      className={cn(
        "w-full aspect-square",
        "flex flex-col items-center justify-center",
        "outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
      )}
       iconWrapperClassName={cn(
        "h-12 w-12")}
    />
  );
}
