import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { Lock, User, Key } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/common/GlassCard";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";

interface LoginPageProps {
  registerAllowed?: boolean;
}

type LoginMode = "password" | "secret";

export function LoginPage({ registerAllowed = false }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const { loginByPassword, loginBySecret } = useAuth();
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
      if (mode === "password") {
        await loginByPassword(username, password);
      } else {
        await loginBySecret(secret);
      }
      navigate("/files");
    } catch (err: any) {
      setError(err?.message || "登录失败");
    }
  };

  return (
    <div className={cn("relative flex min-h-screen items-center justify-center p-4 overflow-hidden", DS.layout.pageBackground)}>
      {/* 装饰性背景光斑 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] opacity-50 pointer-events-none" />

      <GlassCard variant="strong" className="w-full max-w-sm space-y-6 p-8 z-10">
        <div className="flex flex-col space-y-2 text-center">
          <h3 className={cn("text-2xl", DS.text.heading)}>登录 FileCloud</h3>
          <p className={DS.text.subheading}>
            {mode === "password" ? "使用用户名和密码登录" : "使用密钥登录"}
          </p>
        </div>

        {/* 登录方式切换 */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "password" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("password")}
          >
            <User className="mr-2 h-4 w-4" />
            密码登录
          </Button>
          <Button
            type="button"
            variant={mode === "secret" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("secret")}
          >
            <Key className="mr-2 h-4 w-4" />
            密钥登录
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "password" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="输入用户名"
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
                    placeholder="输入密码"
                    className="pl-9 bg-background/50 border-white/10 focus:bg-background/80 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="secret">密钥</Label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
          )}
          <Button type="submit" className="w-full h-10 shadow-lg hover:shadow-primary/20">
            登录
          </Button>
        </form>

        {/* 注册入口 */}
        {registerAllowed && (
          <div className="text-center text-sm">
            <span className="text-muted-foreground">还没有账号？</span>
            <Link to="/register" className="ml-1 text-primary hover:underline">
              立即注册
            </Link>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
