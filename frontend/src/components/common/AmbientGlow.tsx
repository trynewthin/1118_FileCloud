import { cn } from "@/lib/utils";
import { motion } from "motion/react";

interface AmbientGlowProps {
  className?: string;
  // variant 目前主要保留接口兼容，实际颜色由 CSS 变量 (primary/accent) 决定
  variant?: "primary" | "cool" | "warm";
  position?: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
}

export function AmbientGlow({
  className,
  position = "top-right",
}: AmbientGlowProps) {
  const positionClasses = {
    "top-left": "-top-[18%] -left-[8%]",
    "top-right": "-top-[18%] -right-[8%]",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    "bottom-left": "-bottom-[18%] -left-[8%]",
    "bottom-right": "-bottom-[18%] -right-[8%]",
  }[position];

  return (
    <div
      className={cn(
        // 固定一个较大的容器，避免光晕被完全偏移出视口
        "absolute z-0 pointer-events-none w-[640px] h-[640px] overflow-visible",
        positionClasses,
        className,
      )}
    >
      {/* 主光晕层：使用 Primary 色，缓慢呼吸 */}
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.7, 0.45, 0.7],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={cn(
          "absolute inset-0 rounded-full",
          "bg-primary/30 blur-[140px]",
          "dark:bg-primary/20 dark:blur-[160px]",
        )}
      />

      {/* 辅助光晕层：使用 Accent 色，错位移动，增加层次感 */}
      <motion.div
        animate={{
          scale: [1.05, 0.95, 1.05],
          x: [-24, 24, -24],
          y: [12, -12, 12],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2,
        }}
        className={cn(
          "absolute inset-10 rounded-full",
          "bg-accent/35 blur-[120px]",
          "dark:bg-accent/25 dark:blur-[140px]",
        )}
      />
    </div>
  );
}
