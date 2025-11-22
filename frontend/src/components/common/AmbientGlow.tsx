import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

interface AmbientGlowProps {
  className?: string;
  variant?: "primary" | "cool" | "warm";
  position?: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
}

export function AmbientGlow({ 
  className, 
  variant = "primary",
  position = "top-right"
}: AmbientGlowProps) {
  
  const positionClasses = {
    "top-left": "-top-20 -left-20",
    "top-right": "-top-20 -right-20",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "bottom-left": "-bottom-20 -left-20",
    "bottom-right": "-bottom-20 -right-20",
  }[position];

  return (
    <div 
      className={cn(
        DS.glow[variant],
        positionClasses,
        "opacity-60 dark:opacity-40", // 深色模式下减弱光晕
        className
      )} 
    />
  );
}
