import { PageContainer } from "@/components/layout/PageContainer";
import { useNavigate } from "react-router-dom";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <PageContainer title="系统设置" scroll scrollFullBleed>
      <div className="mt-2">
        <SettingsGroup title="外观与主题">
          <SettingsItemCard
            title="主题与背景"
            description="主题颜色、毛玻璃风格、按钮形状、背景设置等。"
            onClick={() => navigate("/settings/theme")}
          />
        </SettingsGroup>
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
          <SettingsItemCard
            title="测试页面"
            onClick={() => navigate("/settings/test")}
          />
        </SettingsGroup>
      </div>
    </PageContainer>
  );
}
