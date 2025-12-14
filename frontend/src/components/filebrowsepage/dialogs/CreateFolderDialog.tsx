import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/dialog/dialog";
import { GlassCard } from "@/components/common/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { XIcon, Check } from "lucide-react";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 对话框关闭时重置状态
  useEffect(() => {
    if (!open) {
      setName("");
      setError("");
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (loading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("文件夹名称不能为空");
      return;
    }

    // 校验非法字符
    if (/[\\/:*?"<>|]/.test(trimmedName)) {
      setError("文件夹名称包含非法字符");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // 先关闭对话框，不等待任务完成
      onOpenChange(false);
      // 后台执行创建操作，不阻塞 UI
      onSubmit(trimmedName)
        .then(() => toast.success("文件夹创建成功"))
        .catch((err) => {
          console.error("创建文件夹失败", err);
          toast.error(err?.message || "创建文件夹失败");
        });
    } catch (err: any) {
      setError(err?.message || "创建失败");
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]" showCloseButton={false}>
        <GlassCard variant="lite" className="p-4">
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>
              在当前目录下创建一个新的文件夹
            </DialogDescription>
          </DialogHeader>
        </GlassCard>

        <div className="grid gap-3 py-3">
          <GlassCard variant="lite" className="p-4">
            <div className="grid gap-2">
              <Label htmlFor="folderName">文件夹名称</Label>
              <Input
                id="folderName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入文件夹名称"
                className="bg-background/50 border-white/10 focus:bg-background/80"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                autoFocus
              />
            </div>
          </GlassCard>

          {error && (
            <GlassCard variant="lite" className="p-3">
              <div className="text-sm text-red-500">{error}</div>
            </GlassCard>
          )}
        </div>
        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={handleClose}
          leftButtonGlassVariant="lite"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        />
      </DialogContent>
    </Dialog>
  );
}
