import { cn } from "@/lib/utils";
import { motion } from "motion/react";

interface AmbientGlowProps {
  className?: string;
  // variant 目前主要保留接口兼容，实际颜色由 CSS 变量 (primary/accent) 决定
  variant?: "primary" | "cool" | "warm";
  position?: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
  // 兼容模式：为 true 时关闭动画，仅保留静态光晕
  compatMode?: boolean;
}

export function AmbientGlow({
  className,
  position = "top-right",
  compatMode = false,
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
        "absolute z-0 pointer-events-none w-[900px] h-[900px] overflow-visible",
        positionClasses,
        className,
      )}
    >
      {compatMode ? (
        <>
          {/* 兼容模式：静态光晕，无动画，减少闪烁风险 */}
          <div
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-primary/35 blur-[180px]",
              "dark:bg-primary/28 dark:blur-[200px]",
            )}
          />
          <div
            className={cn(
              "absolute inset-10 rounded-full",
              "bg-accent/38 blur-[150px]",
              "dark:bg-accent/30 dark:blur-[170px]",
            )}
          />
          <div
            className={cn(
              "absolute inset-0",
              "bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary))_0%,transparent_62%)]",
              "opacity-30 blur-[80px]",
              "dark:opacity-22",
            )}
          />
        </>
      ) : (
        <>
          <motion.div
            animate={{
              rotate: [0, 360],
              opacity: [0.55, 0.35, 0.55],
              scale: [1.02, 1.08, 1.02],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "linear",
            }}
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-[conic-gradient(from_90deg,rgba(255,255,255,0)_0deg,hsl(var(--primary))_90deg,hsl(var(--accent))_180deg,hsl(var(--primary))_270deg,rgba(255,255,255,0)_360deg)]",
              "blur-[70px]",
              "mix-blend-screen",
              "saturate-[1.8] contrast-[1.2]",
            )}
          />

          {/* 主光晕层：使用 Primary 色，缓慢呼吸 */}
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.85, 0.55, 0.85],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-primary/45 blur-[190px]",
              "dark:bg-primary/34 dark:blur-[210px]",
              "mix-blend-screen",
              "saturate-[1.6]",
            )}
          />

          {/* 辅助光晕层：使用 Accent 色，错位移动，增加层次感 */}
          <motion.div
            animate={{
              scale: [1.1, 0.95, 1.1],
              x: [-36, 36, -36],
              y: [18, -18, 18],
              rotate: [-6, 6, -6],
            }}
            transition={{
              duration: 14,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.2,
            }}
            className={cn(
              "absolute inset-10 rounded-full",
              "bg-accent/48 blur-[160px]",
              "dark:bg-accent/36 dark:blur-[185px]",
              "mix-blend-screen",
              "saturate-[1.6]",
            )}
          />

          <motion.div
            animate={{
              scale: [1.0, 1.06, 1.0],
              x: [10, -14, 10],
              y: [-12, 14, -12],
              opacity: [0.55, 0.35, 0.55],
            }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.6,
            }}
            className={cn(
              "absolute inset-0",
              "bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary))_0%,transparent_62%)]",
              "opacity-40 blur-[90px]",
              "dark:opacity-30",
              "mix-blend-screen",
              "saturate-[1.8] contrast-[1.15]",
            )}
          />

          <motion.div
            animate={{
              rotate: [0, -360],
              x: [-18, 18, -18],
              y: [14, -14, 14],
              opacity: [0.28, 0.18, 0.28],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "linear",
            }}
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0)_0deg,rgba(255,255,255,0)_14deg,hsl(var(--accent))_16deg,rgba(255,255,255,0)_22deg)]",
              "blur-[55px]",
              "mix-blend-screen",
              "saturate-[2]",
            )}
          />
        </>
      )}
    </div>
  );
}
