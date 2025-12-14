import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassButton } from "@/components/common/button/GlassButton";
import type { FileEntry } from "@/lib/api/files";
import { smartRename } from "@/lib/api/aiChat";
import { XIcon, Check, Sparkles } from "lucide-react";

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
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setNewName(entry.original_name);
      setPassword("");
      setError("");
    }
  }, [open, entry]);

  const handleSmartRename = async () => {
    if (!entry || aiLoading) return;

    setAiLoading(true);

    try {
      // 分离文件名和扩展名
      const originalName = entry.original_name;
      const lastDotIndex = originalName.lastIndexOf(".");
      const hasExtension = lastDotIndex > 0 && lastDotIndex < originalName.length - 1;
      
      const fileName = hasExtension ? originalName.substring(0, lastDotIndex) : originalName;
      const fileExtension = hasExtension ? originalName.substring(lastDotIndex + 1) : undefined;

      const result = await smartRename({
        fileName,
        fileExtension,
        entryId: entry.id,
      });

      // 检查 AI 是否返回特定标记（UNKNOWN）
      if (result.suggestedName.trim().toUpperCase() === "UNKNOWN") {
        toast.info("AI 无法根据当前上下文判断出更好的文件名");
        return;
      }

      // 如果有扩展名，拼接回去
      const suggestedFullName = fileExtension 
        ? `${result.suggestedName}.${fileExtension}`
        : result.suggestedName;

      setNewName(suggestedFullName);
      toast.success("已生成智能建议");
    } catch (err: any) {
      const message = err.message || "智能重命名失败";
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  };

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
      toast.success("重命名成功");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "重命名失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px]" 
        showCloseButton={false}
        rightButton={
          <GlassButton
            glassVariant="lite"
            size="icon"
            onClick={handleSmartRename}
            disabled={aiLoading || loading}
            className="h-7 w-7"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="sr-only">智能重命名</span>
          </GlassButton>
        }
      >
        <form onSubmit={(e) => handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                disabled={aiLoading}
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
