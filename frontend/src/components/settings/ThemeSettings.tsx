import { Check } from "lucide-react";
import { GlassCard } from "@/components/common/GlassCard";
import { useColorTheme } from "@/hooks/useColorTheme";
import { cn } from "@/lib/utils";

/**
 * 主题设置组件
 * 支持多种颜色系切换，状态持久化在前端 localStorage
 */
export function ThemeSettings() {
  const { colorTheme, setColorTheme, themes, currentThemeInfo } = useColorTheme();

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground">主题颜色</div>
      <GlassCard variant="lite" className="p-4 space-y-3">
        {/* 颜色选择区域：支持自动换行 */}
        <div className="flex flex-wrap items-center gap-3">
          {themes.map((theme) => {
            const isActive = colorTheme === theme.id;
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
                    : "border-transparent hover:border-muted-foreground/30"
                )}
                // 支持纯色和线性渐变两种预览色
                style={{ background: theme.previewColor }}
                title={theme.name}
              >
                {/* 选中标记 */}
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 当前主题描述 */}
        <div className="text-sm">
          <span className="font-medium">{currentThemeInfo.name}</span>
          <span className="text-muted-foreground ml-2">{currentThemeInfo.description}</span>
        </div>
      </GlassCard>
    </div>
  );
}
