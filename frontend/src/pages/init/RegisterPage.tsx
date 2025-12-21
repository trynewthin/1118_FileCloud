import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Lock, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { registerUser } = useAuth();
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

    // 验证
    if (username.trim().length < 2) {
      setError("用户名至少需要 2 个字符");
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    try {
      await registerUser(username.trim(), password);
      navigate("/files");
    } catch (err: any) {
      setError(err?.message || "注册失败");
    }
  };

  return (
    <div className={cn("relative flex min-h-screen items-center justify-center p-4 overflow-hidden", DS.layout.pageBackground)}>
      {/* 装饰性背景光斑 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] opacity-50 pointer-events-none" />

      <GlassCard variant="strong" className="w-full max-w-sm space-y-6 p-8 z-10">
        <div className="flex flex-col space-y-2 text-center">
          <h3 className={cn("text-2xl", DS.text.heading)}>注册 FileCloud</h3>
          <p className={DS.text.subheading}>创建您的账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                placeholder="输入用户名（至少 2 个字符）"
                className="pl-9 bg-background/50 border-white/10 focus:bg-background/80 transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="输入密码（至少 6 个字符）"
                className="pl-9 bg-background/50 border-white/10 focus:bg-background/80 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                className="pl-9 bg-background/50 border-white/10 focus:bg-background/80 transition-all"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-10 shadow-lg hover:shadow-primary/20">
            注册
          </Button>
        </form>

        {/* 登录入口 */}
        <div className="text-center text-sm">
          <span className="text-muted-foreground">已有账号？</span>
          <Link to="/login" className="ml-1 text-primary hover:underline">
            立即登录
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
