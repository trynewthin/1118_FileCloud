import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Server } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InitPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const { initAdminWithSecret } = useAuth();
  const navigate = useNavigate();

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await initAdminWithSecret(secret);
      navigate("/files");
    } catch (err: any) {
      setError(err?.message || "初始化失败");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 text-center">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">系统初始化</h3>
          <p className="text-sm text-muted-foreground">请设置管理员密钥以开始使用</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secret">设置密钥</Label>
            <div className="relative">
              <Server className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="secret"
                type="password"
                placeholder="输入新的密钥"
                className="pl-9"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            初始化系统
          </Button>
        </form>
      </div>
    </div>
  );
}
