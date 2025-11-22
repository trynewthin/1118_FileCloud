import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileEntry } from "@/lib/api/files";
import { XIcon, Check } from "lucide-react";

interface RenameDialogProps {
  entry: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: FileEntry, newName: string, password?: string) => Promise<void>;
}

export function RenameDialog({ entry, open, onOpenChange, onSubmit }: RenameDialogProps) {
  const [newName, setNewName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && entry) {
      setNewName(entry.original_name);
      setPassword("");
      setError("");
    }
  }, [open, entry]);

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) {
      e.preventDefault();
    }
    if (!entry) return;
    
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("名称不能为空");
      return;
    }

    if (trimmed === entry.original_name) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit(entry, trimmed, password || undefined);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "重命名失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" showCloseButton={false}>
        <form onSubmit={(e) => handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
            <DialogDescription>
              请输入新的名称。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            {/* 暂时隐藏密码框，除非后端返回需要密码，这里为了通用先预留，或者默认不显示 */}
            {/* 如果需要支持加密目录操作，可以在这里加密码输入框，或者由外层 logic 决定是否显示 */}
          </div>
          {error && <div className="text-sm text-red-500 mb-4">{error}</div>}
          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
            leftButtonGlassVariant="ghost"
            rightButtonIcon={<Check className="h-4 w-4" />}
            onRightButtonClick={() => { if (!loading) handleSubmit(null); }}
            rightButtonGlassVariant="lite"
          >
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
