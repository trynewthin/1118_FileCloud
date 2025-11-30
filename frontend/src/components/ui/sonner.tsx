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

// 基础玻璃样式（与 GlassCard lite 一致）
const glassBase = "bg-background/50 backdrop-blur-md shadow-md"

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
          toast: cn(glassBase, "rounded-xl border border-white/10"),
          title: "text-foreground font-medium text-sm",
          description: "text-muted-foreground text-xs",
          success: stateStyles.success,
          error: stateStyles.error,
          warning: stateStyles.warning,
          info: stateStyles.info,
          closeButton: cn(
            "bg-background/50 backdrop-blur-sm border-white/10",
            "hover:bg-background/80 hover:border-white/20",
            "transition-all duration-200"
          ),
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
