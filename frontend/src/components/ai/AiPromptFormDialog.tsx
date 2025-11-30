import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AiChatPrompt, CreateAiChatPromptRequest } from "@/lib/api/aiConfig";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Trash2, Check } from "lucide-react";

interface AiPromptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPrompt?: AiChatPrompt;
  onSubmit: (data: CreateAiChatPromptRequest) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

export function AiPromptFormDialog({
  open,
  onOpenChange,
  editingPrompt,
  onSubmit,
  onDelete,
}: AiPromptFormDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (editingPrompt) {
      setTitle(editingPrompt.title);
      setContent(editingPrompt.content);
      setIsDefault(editingPrompt.is_default);
    } else {
      setTitle("");
      setContent("");
      setIsDefault(false);
    }
  }, [editingPrompt]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), content, isDefault });
      toast.success(editingPrompt ? "提示词已更新" : "提示词已创建");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPrompt || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(editingPrompt.id);
      toast.success("提示词已删除");
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && !deleting && onOpenChange(v)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{editingPrompt ? "编辑提示词" : "新建提示词"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="prompt-title">标题</Label>
            <Input
              id="prompt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="prompt-content">内容</Label>
            <Textarea
              id="prompt-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 min-h-[120px]"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="prompt-default"
              checked={isDefault}
              onCheckedChange={(v) => setIsDefault(!!v)}
            />
            <Label htmlFor="prompt-default">设为默认提示词</Label>
          </div>
        </div>
        <DialogFooter
          leftButtonIcon={editingPrompt && onDelete ? <Trash2 className="h-4 w-4" /> : undefined}
          onLeftButtonClick={editingPrompt && onDelete ? () => setConfirmDeleteOpen(true) : undefined}
          leftButtonGlassVariant="ghost"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        >
        </DialogFooter>
      </DialogContent>
      {editingPrompt && onDelete && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除提示词</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除该提示词吗？此操作不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}
