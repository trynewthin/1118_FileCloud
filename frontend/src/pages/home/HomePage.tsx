import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/button/GlassButton";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <PageContainer title="首页" className="h-full flex flex-col">
      <GlassCard variant="ghost" className="flex-1 min-h-0 p-4 md:p-6">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-semibold">FileCloud</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              选择一个入口开始使用：文件浏览、AI、标签或设置。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <GlassButton
              glassVariant="lite"
              className="justify-start h-11"
              onClick={() => navigate("/files")}
            >
              文件浏览
            </GlassButton>

            <GlassButton
              glassVariant="lite"
              className="justify-start h-11"
              onClick={() => navigate("/ai")}
            >
              AI 聊天
            </GlassButton>

            <GlassButton
              glassVariant="lite"
              className="justify-start h-11"
              onClick={() => navigate("/tags")}
            >
              标签管理
            </GlassButton>

            <GlassButton
              glassVariant="lite"
              className="justify-start h-11"
              onClick={() => navigate("/settings")}
            >
              系统设置
            </GlassButton>

            <GlassButton
              glassVariant="lite"
              className="justify-start h-11"
              onClick={() => navigate("/settings/tasks")}
            >
              任务中心
            </GlassButton>

            <GlassButton
              glassVariant="lite"
              className="justify-start h-11"
              onClick={() => navigate("/settings/ai")}
            >
              AI 设置
            </GlassButton>
          </div>
        </div>
      </GlassCard>
    </PageContainer>
  );
}
