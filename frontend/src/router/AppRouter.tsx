import { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { apiGetRegisterStatus } from "@/lib/api/init";
import { useAuth } from "@/hooks/useAuth";
const RootLayout = lazy(() => import("@/pages/home/RootLayout").then((module) => ({ default: module.RootLayout })));
const HomePage = lazy(() => import("@/pages/home/HomePage").then((module) => ({ default: module.HomePage })));
const FileBrowserPage = lazy(() => import("@/pages/home/FileBrowserPage").then((module) => ({ default: module.FileBrowserPage })));
const FilePreviewPage = lazy(() => import("@/pages/home/FilePreviewPage").then((module) => ({ default: module.FilePreviewPage })));
const AiChatPage = lazy(() => import("@/pages/home/AiChatPage").then((module) => ({ default: module.AiChatPage })));
const TagsManagePage = lazy(() => import("@/pages/home/TagsManagePage").then((module) => ({ default: module.TagsManagePage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const ThemeSettingsPage = lazy(() => import("@/pages/settings/ThemeSettingsPage").then((module) => ({ default: module.ThemeSettingsPage })));
const TasksPage = lazy(() => import("@/pages/settings/TasksPage").then((module) => ({ default: module.TasksPage })));
const ActivityLogsPage = lazy(() => import("@/pages/settings/ActivityLogsPage").then((module) => ({ default: module.ActivityLogsPage })));
const AiSettingsPage = lazy(() => import("@/pages/settings/AiSettingsPage").then((module) => ({ default: module.AiSettingsPage })));
const AiModelManagementPage = lazy(() => import("@/pages/settings/AiModelManagementPage").then((module) => ({ default: module.AiModelManagementPage })));
const AccountPage = lazy(() => import("@/pages/settings/AccountPage").then((module) => ({ default: module.AccountPage })));
const LoginPage = lazy(() => import("@/pages/init/LoginPage").then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/init/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const TestPlaygroundPage = lazy(() => import("@/pages/test/TestPlaygroundPage").then((module) => ({ default: module.TestPlaygroundPage })));
const RemoteBrowserPage = lazy(() => import("@/pages/remote/RemoteBrowserPage").then((module) => ({ default: module.RemoteBrowserPage })));

export function AppRouter() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>}>
      <AuthGate />
    </Suspense>
  );
}

// 注册状态上下文（供登录页判断是否显示注册入口）
const useRegisterAllowed = () => {
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
        <Route path="/remote/:clientId" element={<RemoteBrowserPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
