import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { apiGetInitStatus } from "@/lib/api/init";
import { useAuth } from "@/hooks/useAuth";
import { RootLayout } from "@/pages/RootLayout";

import { InitPage } from "@/pages/InitPage";
import { LoginPage } from "@/pages/LoginPage";
import { FileLibrariesPage } from "@/pages/FileLibrariesPage";
import { FileBrowserPage } from "@/pages/FileBrowserPage";
import { TasksPage } from "@/pages/TasksPage";
import { ActivityLogsPage } from "@/pages/ActivityLogsPage";
import { SettingsPage } from "@/pages/SettingsPage";

export function AppRouter() {
  return <InitGate />;
}

function InitGate() {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const checkInit = async () => {
      try {
        setError(null);
        const res = await apiGetInitStatus();
        setInitialized(res.initialized);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? "初始化状态查询失败");
      }
    };
    checkInit();
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-red-600">
        Error: {error}
      </div>
    );
  }

  if (initialized === null || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  // 1. 未初始化 -> 强制去 Init
  if (!initialized) {
    return (
      <Routes>
        <Route path="/init" element={<InitPage />} />
        <Route path="*" element={<Navigate to="/init" replace />} />
      </Routes>
    );
  }

  // 2. 已初始化但未登录 -> 强制去 Login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 3. 已登录 -> 正常路由
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Navigate to="/files" replace />} />
        <Route path="/libraries" element={<FileLibrariesPage />} />
        <Route path="/files/*" element={<FileBrowserPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/tasks" element={<TasksPage />} />
        <Route path="/settings/logs" element={<ActivityLogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
