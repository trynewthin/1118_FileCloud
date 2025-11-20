import type { FC, PropsWithChildren } from "react";
import { AuthProvider } from "@/hooks/useAuth";

const AppShell: FC<PropsWithChildren> = ({ children }) => {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
};

export const App: FC = () => {
  return (
    <AuthProvider>
      <AppShell>
        {/* 后续在这里接入路由与各个页面（登录 / 文件库 / 文件浏览 / 任务中心 / 设置等） */}
      </AppShell>
    </AuthProvider>
  );
};
