import { Check, Plus } from "lucide-react";
import { useColorTheme } from "@/hooks/useColorTheme";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 主题设置组件
 * 支持多种颜色系切换，状态持久化在前端 localStorage
 */
export function ThemeSettings() {
  const { colorTheme, setColorTheme, themes, currentThemeInfo } = useColorTheme();

  // 仅在右侧直接展示前 5 个主题，其余通过下拉菜单选择
  const visibleThemes = themes.slice(0, 5);
  const extraThemes = themes.slice(5);

  return (
    <SettingsItemCard
      title="主题颜色"
      description={
        <span>
          <span className="font-medium">{currentThemeInfo.name}</span>
          <span className="text-muted-foreground ml-2">{currentThemeInfo.description}</span>
        </span>
      }
      action={
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {/* 直接展示前 5 个主题 */}
          {visibleThemes.map((theme) => {
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
                    : "border-transparent hover:border-muted-foreground/30"
                )}
                title={theme.name}
              >
                {/* 内部实际显示颜色的圆点，保证始终为圆形，避免方块感 */}
                <span
                  className="block w-full h-full rounded-full"
                  style={
                    isGradient
                      ? { backgroundImage: theme.previewColor as string }
                      : { background: theme.previewColor as string }
                  }
                />

                {/* 选中标记 */}
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-4 h-4 text-white drop-shadow-md" />
                  </div>
                )}
              </button>
            );
          })}

          {/* 额外主题通过紧挨圆点的小下拉按钮选择 */}
          {extraThemes.length > 0 && (
            <DropdownMenu>
              {/* 触发器：与颜色圆点视觉统一，仅显示加号图标 */}
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 w-8 aspect-square p-0 border-2 border-muted-foreground/30 rounded-full flex items-center justify-center bg-background/60 hover:border-foreground/60 transition-colors shadow-sm"
                  aria-label="更多主题"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              {/* 菜单：使用网格布局展示额外主题颜色，应用统一玻璃菜单样式 */}
              <DropdownMenuContent className={cn("w-40 p-1", DS.glass.strong, DS.radius.lg, "border-white/10")}
              >
                <div className="grid grid-cols-4 gap-2">
                  {extraThemes.map((theme) => {
                    const isGradient = theme.previewColor.startsWith("linear-gradient");
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className="h-8 flex items-center justify-center bg-transparent border-0 outline-none focus:outline-none"
                        onClick={() => setColorTheme(theme.id)}
                      >
                        <span className="sr-only">{theme.name}</span>
                        <span
                          className="inline-block w-6 h-6 rounded-full border border-border"
                          style={
                            isGradient
                              ? { backgroundImage: theme.previewColor as string }
                              : { background: theme.previewColor as string }
                          }
                        />
                      </button>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      }
    />
  );
}
