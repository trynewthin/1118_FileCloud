import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { apiGetRegisterStatus } from "@/lib/api/init";
import { useAuth } from "@/hooks/useAuth";
import {
  RootLayout,
  HomePage,
  FileBrowserPage,
  FilePreviewPage,
  AiChatPage,
  TagsManagePage,
  SettingsPage,
  ThemeSettingsPage,
  TasksPage,
  ActivityLogsPage,
  AiSettingsPage,
  AiModelManagementPage,
  AccountPage,
  LoginPage,
  RegisterPage,
  TestPlaygroundPage,
} from "@/pages";

export function AppRouter() {
  return <AuthGate />;
}

// 注册状态上下文（供登录页判断是否显示注册入口）
export const useRegisterAllowed = () => {
  const [allowed, setAllowed] = useState<boolean>(false);
  
  useEffect(() => {
    apiGetRegisterStatus()
      .then((res) => setAllowed(res.allowed))
      .catch(() => setAllowed(false));
  }, []);
  
  return allowed;
};

function AuthGate() {
  const { user, loading: authLoading } = useAuth();
  const registerAllowed = useRegisterAllowed();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  // 未登录 -> 显示登录/注册页
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage registerAllowed={registerAllowed} />} />
        {registerAllowed && <Route path="/register" element={<RegisterPage />} />}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 已登录 -> 正常路由
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/test" element={<Navigate to="/settings/test" replace />} />
        <Route path="/tags" element={<TagsManagePage />} />
        <Route path="/files/*" element={<FileBrowserPage />} />
        <Route path="/preview/:id" element={<FilePreviewPage />} />
        <Route path="/ai" element={<AiChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/test" element={<TestPlaygroundPage />} />
        <Route path="/settings/theme" element={<ThemeSettingsPage />} />
        <Route path="/settings/tasks" element={<TasksPage />} />
        <Route path="/settings/logs" element={<ActivityLogsPage />} />
        <Route path="/settings/ai" element={<AiSettingsPage />} />
        <Route path="/settings/ai/models" element={<AiModelManagementPage />} />
        <Route path="/settings/account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
