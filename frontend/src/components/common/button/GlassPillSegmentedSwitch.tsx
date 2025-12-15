import React, { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/common/button/GlassButton";

export interface GlassPillSegmentedSwitchOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface GlassPillSegmentedSwitchProps<T extends string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<GlassPillSegmentedSwitchOption<T>>;
}

function GlassPillSegmentedSwitchInner<T extends string>(
  { className, value, onValueChange, options, ...props }: GlassPillSegmentedSwitchProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      className={cn("inline-flex items-center gap-1 rounded-full bg-muted/40 p-1", className)}
      {...props}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <GlassButton
            key={opt.value}
            type="button"
            glassVariant="ghost"
            variant="ghost"
            selected={selected}
            disabled={opt.disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "h-auto px-3 py-1.5 text-xs rounded-full transition-all",
              !selected && "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5">
              {opt.icon}
              <span>{opt.label}</span>
            </span>
          </GlassButton>
        );
      })}
    </div>
  );
}

const GlassPillSegmentedSwitchBase = forwardRef(GlassPillSegmentedSwitchInner);
(GlassPillSegmentedSwitchBase as any).displayName = "GlassPillSegmentedSwitch";

export const GlassPillSegmentedSwitch = GlassPillSegmentedSwitchBase as <T extends string>(
  props: GlassPillSegmentedSwitchProps<T> & React.RefAttributes<HTMLDivElement>
) => React.ReactElement;
