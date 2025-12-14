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
import type { FileEntry } from "@/lib/api/files";
import { XIcon, Trash2 } from "lucide-react";

interface DeleteDialogProps {
  entry: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: FileEntry, password?: string) => Promise<void>;
}

export function DeleteDialog({ entry, open, onOpenChange, onSubmit }: DeleteDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) {
      e.preventDefault();
    }
    if (!entry) return;

    setLoading(true);
    setError("");
    try {
      await onSubmit(entry, password || undefined);
      toast.success("已移入回收站");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "删除失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" showCloseButton={false}>
        <form onSubmit={(e) => handleSubmit(e)}>
          <GlassCard variant="lite" className="p-4">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                您确定要删除 "{entry?.original_name}" 吗？文件将被移动到回收站。
              </DialogDescription>
            </DialogHeader>
          </GlassCard>
          {/* 
          <div className="grid gap-4 py-4">
             <div className="grid gap-2">
              <Label htmlFor="password">访问密码（如果需要）</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div> 
          </div>
          */}
          {error && (
            <div className="py-3">
              <GlassCard variant="lite" className="p-3">
                <div className="text-sm text-red-500">{error}</div>
              </GlassCard>
            </div>
          )}
          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
            leftButtonGlassVariant="lite"
            rightButtonIcon={<Trash2 className="h-4 w-4" />}
            onRightButtonClick={() => { if (!loading) handleSubmit(null); }}
            rightButtonGlassVariant="lite"
          >
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
