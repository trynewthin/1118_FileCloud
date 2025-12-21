import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { User, Shield, Trash2, Plus, Key, LogOut, RefreshCw, Copy, Check } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";
import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  changePassword,
  getSecretStatus,
  generateSecret,
  deleteSecret,
  getUsers,
  createUser,
  deleteUser,
  updateUser,
  type UserListItem,
  type UserRole,
} from "@/lib/api/auth";
import { cn } from "@/lib/utils";

export function AccountPage() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  // 修改密码状态
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // 用户管理状态（仅管理员）
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 创建用户对话框
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");
  const [creatingUser, setCreatingUser] = useState(false);

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserListItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // 重置密码对话框
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<UserListItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // 密钥管理状态
  const [hasSecret, setHasSecret] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(true);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [generatingSecret, setGeneratingSecret] = useState(false);
  const [deletingSecret, setDeletingSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  // 加载密钥状态
  const loadSecretStatus = useCallback(async () => {
    setLoadingSecret(true);
    try {
      const res = await getSecretStatus();
      setHasSecret(res.hasSecret);
    } catch (err: any) {
      toast.error(err?.message || "加载密钥状态失败");
    } finally {
      setLoadingSecret(false);
    }
  }, []);

  useEffect(() => {
    loadSecretStatus();
  }, [loadSecretStatus]);

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await getUsers();
      setUsers(res.users);
    } catch (err: any) {
      toast.error(err?.message || "加载用户列表失败");
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 修改密码
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少需要 6 个字符");
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("密码修改成功");
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "密码修改失败");
    } finally {
      setChangingPassword(false);
    }
  };

  // 创建用户
  const handleCreateUser = async () => {
    if (newUsername.trim().length < 2) {
      toast.error("用户名至少需要 2 个字符");
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error("密码至少需要 6 个字符");
      return;
    }

    setCreatingUser(true);
    try {
      await createUser({
        username: newUsername.trim(),
        password: newUserPassword,
        role: newUserRole,
      });
      toast.success("用户创建成功");
      setCreateDialogOpen(false);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("user");
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "创建用户失败");
    } finally {
      setCreatingUser(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      await deleteUser(userToDelete.id);
      toast.success("用户已删除");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "删除用户失败");
    } finally {
      setDeletingUser(false);
    }
  };

  // 重置用户密码
  const handleResetPassword = async () => {
    if (!userToReset) return;
    if (resetPassword.length < 6) {
      toast.error("新密码至少需要 6 个字符");
      return;
    }

    setResettingPassword(true);
    try {
      await updateUser(userToReset.id, { password: resetPassword });
      toast.success("密码已重置");
      setResetDialogOpen(false);
      setUserToReset(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err?.message || "重置密码失败");
    } finally {
      setResettingPassword(false);
    }
  };

  // 切换用户角色
  const handleToggleRole = async (targetUser: UserListItem) => {
    const newRole: UserRole = targetUser.role === "admin" ? "user" : "admin";
    try {
      await updateUser(targetUser.id, { role: newRole });
      toast.success(`已将 ${targetUser.username} 的角色更改为 ${newRole === "admin" ? "管理员" : "普通用户"}`);
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "更改角色失败");
    }
  };

  // 生成/重新生成密钥
  const handleGenerateSecret = async () => {
    setGeneratingSecret(true);
    try {
      const res = await generateSecret();
      setGeneratedSecret(res.secret);
      setSecretDialogOpen(true);
      setHasSecret(true);
      toast.success(hasSecret ? "密钥已重新生成" : "密钥已生成");
    } catch (err: any) {
      toast.error(err?.message || "生成密钥失败");
    } finally {
      setGeneratingSecret(false);
    }
  };

  // 删除密钥
  const handleDeleteSecret = async () => {
    setDeletingSecret(true);
    try {
      await deleteSecret();
      setHasSecret(false);
      toast.success("密钥已删除");
    } catch (err: any) {
      toast.error(err?.message || "删除密钥失败");
    } finally {
      setDeletingSecret(false);
    }
  };

  // 复制密钥
  const handleCopySecret = async () => {
    if (!generatedSecret) return;
    try {
      await navigator.clipboard.writeText(generatedSecret);
      setSecretCopied(true);
      toast.success("密钥已复制到剪贴板");
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <PageContainer title="账户管理" showBack scroll scrollFullBleed>
      {/* 当前账户信息 */}
      <div className="mt-2">
        <SettingsGroup title="我的账户">
          <GlassCard variant="lite" className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">{user?.username}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span>{user?.role === "admin" ? "管理员" : "普通用户"}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <SettingsItemCard
            title="修改密码"
            description="更改您的登录密码"
            onClick={() => setPasswordDialogOpen(true)}
          />

          {/* 密钥管理 */}
          <GlassCard variant="lite" className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">登录密钥</div>
                <div className="text-xs text-foreground/70 mt-0.5">
                  {loadingSecret
                    ? "加载中..."
                    : hasSecret
                    ? "已启用密钥登录"
                    : "未设置密钥"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasSecret && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDeleteSecret}
                    disabled={deletingSecret}
                  >
                    {deletingSecret ? "删除中..." : "关闭"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleGenerateSecret}
                  disabled={generatingSecret}
                >
                  {hasSecret ? (
                    <>
                      <RefreshCw className={cn("h-3.5 w-3.5", generatingSecret && "animate-spin")} />
                      重新生成
                    </>
                  ) : (
                    <>
                      <Key className="h-3.5 w-3.5" />
                      生成密钥
                    </>
                  )}
                </Button>
              </div>
            </div>
          </GlassCard>

          <SettingsItemCard
            title={
              <span className="text-destructive">退出登录</span>
            }
            description="退出当前账户"
            action={
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            }
          />
        </SettingsGroup>
      </div>

      {/* 用户管理（仅管理员可见） */}
      {isAdmin && (
        <div className="mt-8">
          <SettingsGroup title="用户管理">
            <div className="flex justify-end mb-2">
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                新建用户
              </Button>
            </div>

            {loadingUsers ? (
              <GlassCard variant="lite" className="p-8 text-center text-muted-foreground">
                加载中...
              </GlassCard>
            ) : users.length === 0 ? (
              <GlassCard variant="lite" className="p-8 text-center text-muted-foreground">
                暂无用户
              </GlassCard>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <GlassCard
                    key={u.id}
                    variant="lite"
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          u.role === "admin" ? "bg-primary/20" : "bg-muted/50"
                        )}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {u.username}
                          {u.id === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(我)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {u.role === "admin" ? "管理员" : "普通用户"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* 切换角色按钮 */}
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title={u.role === "admin" ? "降级为普通用户" : "升级为管理员"}
                          onClick={() => handleToggleRole(u)}
                        >
                          <Shield className={cn("h-4 w-4", u.role === "admin" && "text-primary")} />
                        </Button>
                      )}

                      {/* 重置密码按钮 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="重置密码"
                        onClick={() => {
                          setUserToReset(u);
                          setResetDialogOpen(true);
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>

                      {/* 删除按钮 */}
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="删除用户"
                          onClick={() => {
                            setUserToDelete(u);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </SettingsGroup>
        </div>
      )}

      {/* 修改密码对话框 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>请输入当前密码和新密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码（至少 6 个字符）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? "修改中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建用户对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建用户</DialogTitle>
            <DialogDescription>创建一个新的用户账户</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newUsername">用户名</Label>
              <Input
                id="newUsername"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="输入用户名（至少 2 个字符）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newUserPassword">密码</Label>
              <Input
                id="newUserPassword"
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="输入密码（至少 6 个字符）"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">普通用户</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除用户 <strong>{userToDelete?.username}</strong> 吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deletingUser}>
              {deletingUser ? "删除中..." : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为用户 <strong>{userToReset?.username}</strong> 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resetPassword">新密码</Label>
              <Input
                id="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="输入新密码（至少 6 个字符）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword}>
              {resettingPassword ? "重置中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 密钥显示对话框 */}
      <Dialog open={secretDialogOpen} onOpenChange={(open) => {
        setSecretDialogOpen(open);
        if (!open) setGeneratedSecret(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>您的登录密钥</DialogTitle>
            <DialogDescription>
              请妥善保存此密钥，关闭对话框后将无法再次查看。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={generatedSecret || ""}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopySecret}
              >
                {secretCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              使用此密钥可以在登录页面选择"密钥登录"方式登录。
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setSecretDialogOpen(false);
              setGeneratedSecret(null);
            }}>
              我已保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
