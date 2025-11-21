import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const { loginWithSecret } = useAuth();
  const navigate = useNavigate();

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
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 text-center">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">登录 FileCloud</h3>
          <p className="text-sm text-muted-foreground">请输入管理员密钥以继续</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secret">密钥</Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="secret"
                type="password"
                placeholder="输入您的密钥"
                className="pl-9"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          <Button type="submit" className="w-full">
            登录
          </Button>
        </form>
      </div>
    </div>
  );
}
