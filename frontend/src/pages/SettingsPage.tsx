import { PageContainer } from "@/components/layout/PageContainer";
import { useNavigate } from "react-router-dom";
import { SettingsLinkCard } from "@/components/common/SettingsLinkCard";
import { ThemeSettings } from "@/components/settings/ThemeSettings";

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <PageContainer title="系统设置">
      {/* 主题设置 */}
      <div className="mt-2">
        <ThemeSettings />
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
