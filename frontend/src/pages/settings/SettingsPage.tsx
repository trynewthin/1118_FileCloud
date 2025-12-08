import { PageContainer } from "@/components/layout/PageContainer";
import { useNavigate } from "react-router-dom";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";
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

      {/* UI 兼容模式 */}
      <div className="mt-6">
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
      </div>

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
