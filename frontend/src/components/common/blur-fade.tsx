import { useRef, type ReactNode } from "react"
import {
  AnimatePresence,
  motion,
  type MotionProps,
  useInView,
  type UseInViewOptions,
  type Variants,
} from "motion/react"

import { cn } from "@/lib/utils"

type MarginType = UseInViewOptions["margin"]

interface BlurFadeProps extends MotionProps {
  children: ReactNode
  className?: string
  variant?: {
    hidden: { y: number }
    visible: { y: number }
  }
  duration?: number
  delay?: number
  offset?: number
  direction?: "up" | "down" | "left" | "right"
  inView?: boolean
  inViewMargin?: MarginType
  blur?: string

  radialBlur?: boolean
  radialBlurMax?: string
  radialBlurLayers?: number
  radialBlurInnerStop?: number
  radialBlurOuterStop?: number

  edgeBlur?: "none" | "top" | "bottom" | "both"
  edgeSizePx?: number
  edgeStrength?: number
  cornerStrength?: number
}

export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "down",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  radialBlur = true,
  radialBlurMax = "16px",
  radialBlurLayers = 4,
  radialBlurInnerStop = 35,
  radialBlurOuterStop = 85,
  edgeBlur = "both",
  edgeSizePx = 72,
  edgeStrength = 0.10,
  cornerStrength = 0.22,
  ...props
}: BlurFadeProps) {
  const ref = useRef(null)
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin })
  const isInView = !inView || inViewResult
  const defaultVariants: Variants = {
    hidden: {
      [direction === "left" || direction === "right" ? "x" : "y"]:
        direction === "right" || direction === "down" ? -offset : offset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: {
      [direction === "left" || direction === "right" ? "x" : "y"]: 0,
      opacity: 1,
      filter: `blur(0px)`,
    },
  }
  const combinedVariants = variant || defaultVariants
  void radialBlurInnerStop
  void radialBlurOuterStop
  void radialBlurMax
  void radialBlurLayers

  const { style, ...restProps } = props

  const edgePx = Math.max(0, Math.min(240, edgeSizePx))
  const edgeA = Math.max(0, Math.min(0.6, edgeStrength))
  const cornerA = Math.max(0, Math.min(0.8, cornerStrength))
  const cornerPx = Math.round(edgePx * 1.35)

  const tint = (alpha: number) => `rgb(var(--blurfade-tint) / ${alpha.toFixed(4)})`

  const linearEdge = (dir: "to bottom" | "to top") => {
    const size = Math.max(1, edgePx)
    return `linear-gradient(${dir}, ${tint(edgeA)} 0px, ${tint(0)} ${size}px)`
  }

  const radialCorner = (pos: "top left" | "top right" | "bottom left" | "bottom right") => {
    const size = Math.max(1, cornerPx)
    return `radial-gradient(circle at ${pos}, ${tint(cornerA)} 0px, ${tint(0)} ${size}px)`
  }

  const bgLayers: string[] = []
  if (edgeBlur === "top" || edgeBlur === "both") {
    bgLayers.push(linearEdge("to bottom"))
    if (cornerA > 0) {
      bgLayers.push(radialCorner("top left"))
      bgLayers.push(radialCorner("top right"))
    }
  }
  if (edgeBlur === "bottom" || edgeBlur === "both") {
    bgLayers.push(linearEdge("to top"))
    if (cornerA > 0) {
      bgLayers.push(radialCorner("bottom left"))
      bgLayers.push(radialCorner("bottom right"))
    }
  }

  const radialStyle = radialBlur
    ? {
        // 通过边缘/角落渐变控制“哪里需要模糊”，中心基本不着色
        backgroundImage: bgLayers.length > 0 ? bgLayers.join(", ") : undefined,
      }
    : undefined

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: "easeOut",
        }}
        className={cn(
          "relative",
          radialBlur && "[--blurfade-tint:0_0_0] dark:[--blurfade-tint:255_255_255]",
          radialBlur && "bg-transparent",
          className
        )}
        style={{ ...(style as any), ...(radialStyle as any) }}
        {...restProps}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
