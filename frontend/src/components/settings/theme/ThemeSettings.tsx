import { Check } from "lucide-react";
import { useColorTheme } from "@/hooks/useColorTheme";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";

/**
 * 主题设置组件
 * 支持多种颜色系切换，状态持久化在前端 localStorage
 */
export function ThemeSettings() {
  const { colorTheme, setColorTheme, themes, currentThemeInfo } = useColorTheme();

  return (
    <GlassCard
      variant="lite"
      className={cn(
        "p-3",
        "space-y-2",
      )}
    >
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/90">{currentThemeInfo.name}</span>
        <span className="ml-2">{currentThemeInfo.description}</span>
      </div>

      <GlassCard
        variant="ghost"
        className={cn(
          "p-3",
          "border border-border/30 bg-muted/20",
          "rounded-2xl",
          "button-rect:rounded-xl",
        )}
      >
        <div className="flex flex-wrap gap-2">
          {themes.map((theme) => {
            const isActive = colorTheme === theme.id;
            const isGradient = theme.previewColor.startsWith("linear-gradient");

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setColorTheme(theme.id)}
                className={cn(
                  "relative w-8 h-8 rounded-full transition-all",
                  "border-2 shadow-sm hover:scale-110",
                  isActive
                    ? "border-foreground scale-110"
                    : "border-transparent hover:border-muted-foreground/30",
                )}
                title={theme.name}
              >
                <span
                  className="block w-full h-full rounded-full"
                  style={
                    isGradient
                      ? { backgroundImage: theme.previewColor as string }
                      : { background: theme.previewColor as string }
                  }
                />

                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>
    </GlassCard>
  );
}
