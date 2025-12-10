import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Server } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";

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
    <div className={cn("relative flex min-h-screen items-center justify-center p-4 overflow-hidden", DS.layout.pageBackground)}>
      {/* 装饰性背景光斑 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] opacity-50 pointer-events-none" />

      <GlassCard variant="strong" className="w-full max-w-sm space-y-8 p-8 z-10">
        <div className="flex flex-col space-y-2 text-center">
          <h3 className={cn("text-2xl", DS.text.heading)}>系统初始化</h3>
          <p className={DS.text.subheading}>请设置管理员密钥以开始使用</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="secret">设置密钥</Label>
            <div className="relative">
              <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="secret"
                type="password"
                placeholder="输入新的密钥"
                className="pl-9 bg-background/50 border-white/10 focus:bg-background/80 transition-all"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-10 shadow-lg hover:shadow-primary/20">
            初始化系统
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
