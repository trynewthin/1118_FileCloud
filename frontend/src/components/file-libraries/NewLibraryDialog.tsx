import { useState } from "react";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { GlassButton } from "@/components/common/GlassButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Folder, XIcon, Check, AlertTriangle } from "lucide-react";
import { FolderPickerDialog } from "@/components/files/dialogs/FolderPickerDialog";

interface NewLibraryDialogProps {
  onSuccess?: () => void;
}

/**
 * 检查路径是否为盘符根目录
 * 匹配 C:\、D:\ 等格式
 */
const isDriveRoot = (path: string): boolean => {
  // Windows 盘符根目录：C:\、D:\ 等
  return /^[A-Za-z]:\\?$/.test(path.trim());
};

export function NewLibraryDialog({ onSuccess }: NewLibraryDialogProps) {
  const [open, setOpen] = useState(false);
  const [rootPath, setRootPath] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { create, loading } = useFileLibraries({ autoRefresh: false });
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null); // 待确认的盘符根路径
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) {
      e.preventDefault();
    }
    if (!rootPath) {
      setError("请选择文件库根路径");
      return;
    }
    
    setError("");
    try {
      await create({ rootPath, displayName: displayName || undefined });
      setOpen(false);
      setRootPath("");
      setDisplayName("");
      alert("文件库创建成功，正在后台建立索引，稍后即可查看文件内容。");
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || "创建失败");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <GlassButton className="gap-2" glassVariant="lite">
            <Plus className="h-4 w-4" />
            新建文件库
          </GlassButton>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]" showCloseButton={false}>
          <form onSubmit={(e) => handleSubmit(e)}>
            <DialogHeader>
              <DialogTitle>新建文件库</DialogTitle>
              <DialogDescription>
                添加一个新的本地目录作为文件库。确保后端服务有权限访问该目录。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="grid gap-2">
                <Label>
                  根路径 <span className="text-destructive">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-input bg-background/50 hover:bg-accent/50 transition-colors text-left"
                >
                  <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                  {rootPath ? (
                    <span className="text-sm font-mono truncate">{rootPath}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">点击选择服务器目录...</span>
                  )}
                </button>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayName">
                  显示名称
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="可选，默认使用目录名"
                  className="bg-background/50 border-white/10 focus:bg-background/80"
                />
              </div>
            </div>
            {error && <div className="text-sm text-red-500 mb-4">{error}</div>}
            <DialogFooter
              leftButtonIcon={<XIcon className="h-4 w-4" />}
              onLeftButtonClick={() => { if (!loading) setOpen(false); }}
              leftButtonGlassVariant="ghost"
              rightButtonIcon={<Check className="h-4 w-4" />}
              onRightButtonClick={() => { if (!loading) handleSubmit(null); }}
              rightButtonGlassVariant="lite"
            >
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FolderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="system"
        initialPath={rootPath}
        onSubmit={(val) => {
          // 检查是否为盘符根目录，需要二次确认
          if (isDriveRoot(val)) {
            setPendingPath(val);
            setConfirmOpen(true);
          } else {
            setRootPath(val);
          }
        }}
        title="选择服务器目录"
        description="请选择服务器上的真实目录作为文件库根路径。"
      />

      {/* 盘符根目录二次确认对话框 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              确认选择根目录？
            </AlertDialogTitle>
            <AlertDialogDescription>
              您选择的是盘符根目录 <span className="font-mono font-semibold">{pendingPath}</span>，
              这将索引整个磁盘的所有文件，可能包含系统文件和大量数据。
              <br /><br />
              建议选择一个具体的子目录作为文件库根路径。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPath(null)}>
              <span className="sr-only">取消</span>
              <XIcon className="h-4 w-4" />
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPath) {
                  setRootPath(pendingPath);
                  setPendingPath(null);
                }
              }}
            >
              <span className="sr-only">确认</span>
              <Check className="h-4 w-4" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
