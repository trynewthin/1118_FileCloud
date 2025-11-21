import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { FolderSearch } from "lucide-react";
import type { FileEntry } from "@/lib/api/files";
import { FolderPickerDialog } from "./FolderPickerDialog";

interface MoveCopyDialogProps {
  mode: "move" | "copy";
  entry: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: FileEntry, targetParentId: string | null, newName?: string, password?: string) => Promise<void>;
}

export function MoveCopyDialog({ mode, entry, open, onOpenChange, onSubmit }: MoveCopyDialogProps) {
  const [targetId, setTargetId] = useState("");
  const [newName, setNewName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open && entry) {
      setTargetId(""); // 默认为根或空
      setNewName(mode === "copy" ? entry.original_name : "");
      setPassword("");
      setError("");
    }
  }, [open, entry, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    setLoading(true);
    setError("");
    try {
      // 如果 targetId 为空字符串，视为 null (根目录)
      const pid = targetId.trim() === "" ? null : targetId.trim();
      await onSubmit(entry, pid, newName || undefined, password || undefined);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "move" ? "移动文件" : "复制文件";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                请选择目标文件夹。留空则表示移动/复制到根目录。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="targetId">目标父目录 ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="targetId"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="例如: uuid-..."
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setPickerOpen(true)} title="选择目录">
                    <FolderSearch className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {mode === "copy" && (
                <div className="grid gap-2">
                  <Label htmlFor="newName">新名称（可选）</Label>
                  <Input
                    id="newName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={entry?.original_name}
                  />
                </div>
              )}
            </div>
            {error && <div className="text-sm text-red-500 mb-4">{error}</div>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "处理中..." : "确定"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {entry && (
        <FolderPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          mode="library"
          libraryId={entry.library_id}
          onSubmit={(val) => setTargetId(val)}
          title="选择目标文件夹"
        />
      )}
    </>
  );
}
