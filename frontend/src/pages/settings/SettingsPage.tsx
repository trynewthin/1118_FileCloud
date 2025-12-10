import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useNavigate } from "react-router-dom";
import { ThemeSettings } from "@/components/settings/theme/ThemeSettings";
import { BackgroundSettingsDialog } from "@/components/settings/theme/BackgroundSettingsDialog";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";
import { Switch } from "@/components/ui/switch";
import { useUiCompat } from "@/hooks/useUiCompat";
import { useBlurTheme } from "@/hooks/useBlurTheme";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const navigate = useNavigate();
  const { compatMode, setCompatMode } = useUiCompat();
  const { blurTheme, setBlurTheme } = useBlurTheme();
  const [backgroundDialogOpen, setBackgroundDialogOpen] = useState(false);

  return (
    <PageContainer title="系统设置">
      {/* 主题设置 */}
      <div className="mt-2">
        <SettingsGroup title="外观与主题">
          <ThemeSettings />
          {/* UI 兼容模式 */}
          <SettingsItemCard
            title="兼容模式"
            description="关闭动态背景动画，在部分安卓设备或低性能设备上减少闪烁和卡顿。"
            action={
              <Switch
                checked={compatMode}
                onCheckedChange={(value) => setCompatMode(value)}
              />
            }
          />
          <SettingsItemCard
            title="毛玻璃风格"
            description="在标准与 macOS 风格的毛玻璃效果之间切换。"
            action={
              <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setBlurTheme("classic")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                    blurTheme === "classic"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>标准</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBlurTheme("mac")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                    blurTheme === "mac"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>macOS 风格</span>
                </button>
              </div>
            }
          />
          <SettingsItemCard
            title="背景设置"
            description="在光晕背景与自定义图片背景之间切换。"
            onClick={() => setBackgroundDialogOpen(true)}
          />
        </SettingsGroup>
      </div>

      <BackgroundSettingsDialog
        open={backgroundDialogOpen}
        onOpenChange={setBackgroundDialogOpen}
      />

      {/* 系统页面 */}
      <div className="mt-8">
        <SettingsGroup title="系统页面">
          <SettingsItemCard
            title="任务管理"
            onClick={() => navigate("/settings/tasks")}
          />
          <SettingsItemCard
            title="操作日志"
            onClick={() => navigate("/settings/logs")}
          />
          <SettingsItemCard
            title="AI 设置"
            onClick={() => navigate("/settings/ai")}
          />
        </SettingsGroup>
      </div>
    </PageContainer>
  );
}
