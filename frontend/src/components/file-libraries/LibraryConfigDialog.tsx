import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, XIcon, Check, Trash2, RefreshCw, HardDrive, File, Folder, Database } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { Switch } from "@/components/ui/switch";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import type { FileLibraryStats } from "@/lib/api/fileLibraries";
import { useFileLibraries } from "@/hooks/useFileLibraries";

interface LibraryConfigDialogProps {
  library: FileLibrary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

// 格式化字节数为可读字符串
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function LibraryConfigDialog({
  library,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: LibraryConfigDialogProps) {
  // 使用 hook 管理文件库操作
  const { update, remove, refresh, getStats, reindex } = useFileLibraries({ autoRefresh: false });

  const [displayName, setDisplayName] = useState(library.display_name);
  const [isEnabled, setIsEnabled] = useState(library.is_enabled);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<FileLibraryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  // 加载统计信息
  useEffect(() => {
    if (open) {
      setDisplayName(library.display_name);
      setIsEnabled(library.is_enabled);
      setError("");
      loadStats();
    }
  }, [open, library]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const statsData = await getStats(library.id);
      setStats(statsData);
    } catch (err) {
      console.error("加载统计信息失败", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    
    try {
      await update(library.id, {
        displayName: displayName.trim() || undefined,
        isEnabled,
      });
      toast.success("文件库配置已更新");
      onOpenChange(false);
      onUpdated?.();
    } catch (err: any) {
      setError(err?.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  // 删除文件库
  const handleDelete = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      await remove(library.id);
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err: any) {
      toast.error(err?.message || "删除失败");
    } finally {
      setLoading(false);
    }
  };

  // 刷新状态
  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      await refresh(library.id);
      await loadStats();
      toast.success("状态已刷新");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "刷新失败");
    } finally {
      setLoading(false);
    }
  };

  // 重建索引
  const handleReindex = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      await reindex(library.id);
    } catch (err: any) {
      toast.error(err?.message || "创建索引任务失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              文件库配置
            </DialogTitle>
            <DialogDescription>
              管理文件库 "{library.display_name}" 的配置
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* 基本信息 */}
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="displayName">显示名称</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="文件库名称"
                  className="bg-background/50 border-white/10 focus:bg-background/80"
                />
              </div>

              <div className="grid gap-2">
                <Label>根路径</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-white/10">
                  <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-mono truncate">{library.root_path}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用状态</Label>
                  <p className="text-xs text-muted-foreground">禁用后将无法浏览此文件库</p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                />
              </div>
            </div>

            {/* 统计信息 */}
            <GlassCard variant="ghost" className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">统计信息</span>
                <GlassButton
                  glassVariant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRefresh}
                  disabled={loading || statsLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                </GlassButton>
              </div>
              
              {statsLoading ? (
                <div className="text-sm text-muted-foreground">加载中...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">文件:</span>
                    <span>{stats.totalFiles.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">文件夹:</span>
                    <span>{stats.totalFolders.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">索引大小:</span>
                    <span>{formatBytes(stats.totalSizeBytes)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">磁盘大小:</span>
                    <span>{formatBytes(stats.diskSizeBytes)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">无法加载统计信息</div>
              )}
            </GlassCard>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <GlassButton
                glassVariant="lite"
                className="flex-1 gap-2"
                onClick={handleReindex}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" />
                重建索引
              </GlassButton>
              <GlassButton
                glassVariant="lite"
                className="flex-1 gap-2 text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" />
                删除文件库
              </GlassButton>
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}
          </div>

          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
            leftButtonGlassVariant="ghost"
            rightButtonIcon={<Check className="h-4 w-4" />}
            onRightButtonClick={handleSave}
            rightButtonGlassVariant="lite"
          />
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除文件库？</AlertDialogTitle>
            <AlertDialogDescription>
              删除文件库 "{library.display_name}" 将移除所有索引记录。
              <br /><br />
              <strong>注意：</strong>这不会删除磁盘上的实际文件，只会移除 FileCloud 中的索引。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              <span className="sr-only">取消</span>
              <XIcon className="h-4 w-4" />
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              <span className="sr-only">删除</span>
              <Trash2 className="h-4 w-4" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
