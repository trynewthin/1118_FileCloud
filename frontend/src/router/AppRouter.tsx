import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Routes, Route, Navigate } from "react-router-dom";
import { apiGetInitStatus } from "@/lib/api/init";
import { useAuth } from "@/hooks/useAuth";
import {
  RootLayout,
  FileBrowserPage,
  FilePreviewPage,
  AiChatPage,
  TagsPage,
  SettingsPage,
  TasksPage,
  ActivityLogsPage,
  AiSettingsPage,
  AiModelManagementPage,
  InitPage,
  LoginPage,
} from "@/pages";

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

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        加载失败，请刷新页面重试
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
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/files/*" element={<FileBrowserPage />} />
        <Route path="/preview/:id" element={<FilePreviewPage />} />
        <Route path="/ai" element={<AiChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/tasks" element={<TasksPage />} />
        <Route path="/settings/logs" element={<ActivityLogsPage />} />
        <Route path="/settings/ai" element={<AiSettingsPage />} />
        <Route path="/settings/ai/models" element={<AiModelManagementPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
