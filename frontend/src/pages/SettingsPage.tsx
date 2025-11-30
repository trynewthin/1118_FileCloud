import { PageContainer } from "@/components/layout/PageContainer";
import { useNavigate } from "react-router-dom";
import { SettingsLinkCard } from "@/components/common/SettingsLinkCard";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { GlassCard } from "@/components/common/GlassCard";
import { Switch } from "@/components/ui/switch";
import { useUiCompat } from "@/hooks/useUiCompat";

export function SettingsPage() {
  const navigate = useNavigate();
  const { compatMode, setCompatMode } = useUiCompat();

  return (
    <PageContainer title="系统设置">
      {/* 主题设置 */}
      <div className="mt-2">
        <ThemeSettings />
      </div>

      {/* UI 兼容模式：关闭动态背景动画等效果，解决部分设备闪烁问题 */}
      <div className="mt-6">
        <GlassCard variant="lite" className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-medium">兼容模式</div>
            <div className="text-xs text-muted-foreground mt-1">
              关闭动态背景动画，在部分安卓设备或低性能设备上减少闪烁和卡顿。
            </div>
          </div>
          <Switch
            checked={compatMode}
            onCheckedChange={(value) => setCompatMode(value)}
          />
        </GlassCard>
      </div>

      <div className="mt-8 space-y-3">
        <div className="text-sm font-medium text-muted-foreground">系统页面</div>
        <div className="space-y-2">
          <SettingsLinkCard
            title="任务管理"
            onClick={() => navigate("/settings/tasks")}
          />
          <SettingsLinkCard
            title="操作日志"
            onClick={() => navigate("/settings/logs")}
          />
          <SettingsLinkCard
            title="AI 设置"
            onClick={() => navigate("/settings/ai")}
          />
        </div>
      </div>
    </PageContainer>
  );
}
