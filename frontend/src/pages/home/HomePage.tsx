import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { IconLabelItem } from "@/components/common/item/IconLabelItem";
import { navItems } from "@/configs/nav";
import { cn } from "@/lib/utils";

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

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {navItems
              .filter((item) => item.href !== "/")
              .map((item) => {
                const Icon = item.icon;
                return (
                  <IconLabelItem
                    key={item.href}
                    label={item.title}
                    icon={<Icon className="h-6 w-6" />}
                      className={cn(
                            "flex flex-col items-center justify-center",
                          )}
                    onClick={() => navigate(item.href)}
                  />
                );
              })}
          </div>
        </div>
      </GlassCard>
    </PageContainer>
  );
}
