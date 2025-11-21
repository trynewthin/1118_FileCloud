import { useSettings } from "@/hooks/useSettings";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Save, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function SettingsPage() {
  const navigate = useNavigate();
  const { items, loading, error, reload, update } = useSettings();
  // 本地编辑状态
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // 同步初始值
  useEffect(() => {
    const map: Record<string, string> = {};
    items.forEach(item => {
      map[item.key] = item.value;
    });
    setEditValues(map);
  }, [items]);

  const handleChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      await update(key, editValues[key]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer
      title="系统设置"
      action={
        <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
           <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
           刷新
        </Button>
      }
    >
      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {loading && items.length === 0 ? (
          <div className="col-span-2 text-center text-muted-foreground">加载中...</div>
        ) : (
          items.map((item) => (
            <div key={item.key} className="flex flex-col gap-2 p-4 border rounded-lg bg-card">
              <Label htmlFor={item.key} className="font-medium">{formatSettingKey(item.key)}</Label>
              <div className="flex gap-2">
                <Input
                  id={item.key}
                  value={editValues[item.key] ?? item.value}
                  onChange={(e) => handleChange(item.key, e.target.value)}
                />
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => handleSave(item.key)}
                  disabled={saving || editValues[item.key] === item.value}
                  title="保存修改"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{item.key}</p>
            </div>
          ))
        )}
        {!loading && items.length === 0 && (
          <div className="col-span-2 text-center text-muted-foreground">暂无公开设置项</div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div className="text-sm font-medium text-muted-foreground">系统页面</div>
        <div className="space-y-2">
          <div
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => navigate("/settings/tasks")}
            role="button"
            tabIndex={0}
          >
            <div className="text-sm font-medium">任务管理</div>
            <ChevronRight className="h-4 w-4" />
          </div>
          <div
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => navigate("/settings/logs")}
            role="button"
            tabIndex={0}
          >
            <div className="text-sm font-medium">操作日志</div>
            <ChevronRight className="h-4 w-4" />
          </div>
          <div
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => navigate("/settings/ai")}   
            role="button"
            tabIndex={0}
          >
            <div className="text-sm font-medium">AI 设置</div>
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function formatSettingKey(key: string) {
  // 简单格式化，比如 system_initialized -> System Initialized
  return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
