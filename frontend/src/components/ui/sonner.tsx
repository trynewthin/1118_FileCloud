import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { cn } from "@/lib/utils"
import { DS } from "@/theme/design-system"

// 状态强调色样式（与 GlassButton 类似的边框强调）
const stateStyles = {
  success: "border-success/40 text-success [&_svg]:text-success",
  error: "border-destructive/40 text-destructive [&_svg]:text-destructive",
  warning: "border-warning/40 text-warning [&_svg]:text-warning",
  info: "border-info/40 text-info [&_svg]:text-info",
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          // 使用全局设计系统的玻璃与圆角样式，并强制覆盖 richColors 默认背景
          toast: cn(
            "relative overflow-hidden",
            DS.radius.lg,
            DS.glass.lite,
            "!bg-background/60"
          ),
          title: "text-foreground font-medium text-sm",
          description: "text-muted-foreground text-xs",
          success: stateStyles.success,
          error: stateStyles.error,
          warning: stateStyles.warning,
          info: stateStyles.info,
          actionButton: cn(
            "bg-primary/10 text-primary border-primary/20",
            "hover:bg-primary/20 transition-colors"
          ),
          cancelButton: cn(
            "bg-muted/50 text-muted-foreground border-border/20",
            "hover:bg-muted/80 transition-colors"
          ),
        },
      }}
      closeButton={false}
      style={
        {
          "--normal-bg": "var(--background)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "oklch(1 0 0 / 10%)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
