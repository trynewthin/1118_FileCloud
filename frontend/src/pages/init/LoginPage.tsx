import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const { loginWithSecret } = useAuth();
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
      await loginWithSecret(secret);
      navigate("/files");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    }
  };

  return (
    <div className={cn("relative flex min-h-screen items-center justify-center p-4 overflow-hidden", DS.layout.pageBackground)}>
      {/* Decorative Background Blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] opacity-50 pointer-events-none" />

      <GlassCard variant="strong" className="w-full max-w-sm space-y-8 p-8 z-10">
        <div className="flex flex-col space-y-2 text-center">
          <h3 className={cn("text-2xl", DS.text.heading)}>登录 FileCloud</h3>
          <p className={DS.text.subheading}>请输入管理员密钥以继续</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="secret">密钥</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="secret"
                type="password"
                placeholder="输入您的密钥"
                className="pl-9 bg-background/50 border-white/10 focus:bg-background/80 transition-all"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-10 shadow-lg hover:shadow-primary/20">
            登录
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
