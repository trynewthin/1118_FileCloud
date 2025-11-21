import { useEffect, useState } from "react";
import type { AiChatPrompt, CreateAiChatPromptRequest } from "@/lib/api/aiConfig";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

interface AiPromptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPrompt?: AiChatPrompt;
  onSubmit: (data: CreateAiChatPromptRequest) => Promise<void>;
}

export function AiPromptFormDialog({
  open,
  onOpenChange,
  editingPrompt,
  onSubmit,
}: AiPromptFormDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent>
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
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {editingPrompt ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
