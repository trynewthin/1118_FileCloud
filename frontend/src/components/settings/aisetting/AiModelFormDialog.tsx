import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AiChatModel, AiProvider, CreateAiChatModelRequest } from "@/lib/api/aiConfig";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/common/dialog/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard } from "@/components/common/GlassCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/common/dialog/alert-dialog";
import { Trash2, Check } from "lucide-react";

interface AiModelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: AiProvider[];
  editingModel?: AiChatModel;
  onSubmit: (data: CreateAiChatModelRequest) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

export function AiModelFormDialog({
  open,
  onOpenChange,
  providers,
  editingModel,
  onSubmit,
  onDelete,
}: AiModelFormDialogProps) {
  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [providerId, setProviderId] = useState<string>("none");
  const [modelName, setModelName] = useState("");
  const [apiMode, setApiMode] = useState("chat");
  const [defaultMaxContextMessages, setDefaultMaxContextMessages] = useState("");
  const [allowOverrideContextLimit, setAllowOverrideContextLimit] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (editingModel) {
      setKey(editingModel.key);
      setDisplayName(editingModel.display_name);
      setProviderId(editingModel.provider_id != null ? String(editingModel.provider_id) : "none");
      setModelName(editingModel.model_name);
      setApiMode(editingModel.api_mode);
      setDefaultMaxContextMessages(
        editingModel.default_max_context_messages != null
          ? String(editingModel.default_max_context_messages)
          : "",
      );
      setAllowOverrideContextLimit(editingModel.allow_override_context_limit);
      setIsEnabled(editingModel.is_enabled);
    } else {
      setKey("");
      setDisplayName("");
      setProviderId("none");
      setModelName("");
      setApiMode("chat");
      setDefaultMaxContextMessages("");
      setAllowOverrideContextLimit(true);
      setIsEnabled(true);
    }
  }, [editingModel]);

  const handleSubmit = async () => {
    if (!key.trim() || !displayName.trim() || !modelName.trim() || !apiMode.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        key: key.trim(),
        displayName: displayName.trim(),
        providerId: providerId && providerId !== "none" ? Number(providerId) : null,
        modelName: modelName.trim(),
        apiMode: apiMode.trim(),
        capabilities: [],
        defaultMaxContextMessages: defaultMaxContextMessages
          ? Number(defaultMaxContextMessages)
          : null,
        allowOverrideContextLimit,
        isEnabled,
      });
      toast.success(editingModel ? "模型已更新" : "模型已创建");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingModel || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(editingModel.id);
      toast.success("模型已删除");
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && !deleting && onOpenChange(v)}>
      <DialogContent showCloseButton={false}>
        <GlassCard variant="lite" className="p-4">
          <DialogHeader>
            <DialogTitle>{editingModel ? "编辑模型" : "新建模型"}</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mt-1">
            配置模型的绑定供应商、模型名称、接口模式与上下文限制。
          </div>
        </GlassCard>

        <div className="space-y-3 py-3">
          <GlassCard variant="lite" className="p-4 space-y-4">
            <div>
              <Label htmlFor="model-key">唯一标识</Label>
              <Input
                id="model-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model-name">显示名称</Label>
              <Input
                id="model-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>供应商</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择供应商（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未绑定</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </GlassCard>

          <GlassCard variant="lite" className="p-4 space-y-4">
            <div>
              <Label htmlFor="model-modelname">模型名称</Label>
              <Input
                id="model-modelname"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="例如：gpt-4o-mini"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model-apimode">接口模式</Label>
              <Input
                id="model-apimode"
                value={apiMode}
                onChange={(e) => setApiMode(e.target.value)}
                placeholder="例如：chat 或 vision_chat"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="model-maxctx">默认上下文消息数</Label>
              <Input
                id="model-maxctx"
                type="number"
                value={defaultMaxContextMessages}
                onChange={(e) => setDefaultMaxContextMessages(e.target.value)}
                className="mt-1"
              />
            </div>
          </GlassCard>

          <GlassCard variant="lite" className="p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="model-allowctx"
                checked={allowOverrideContextLimit}
                onCheckedChange={(v) => setAllowOverrideContextLimit(!!v)}
              />
              <Label htmlFor="model-allowctx">允许会话覆盖上下文限制</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="model-enabled"
                checked={isEnabled}
                onCheckedChange={(v) => setIsEnabled(!!v)}
              />
              <Label htmlFor="model-enabled">启用</Label>
            </div>
          </GlassCard>
        </div>
        <DialogFooter
          leftButtonIcon={editingModel && onDelete ? <Trash2 className="h-4 w-4" /> : undefined}
          onLeftButtonClick={editingModel && onDelete ? () => setConfirmDeleteOpen(true) : undefined}
          leftButtonGlassVariant="lite"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        >
        </DialogFooter>
      </DialogContent>
      {editingModel && onDelete && (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除模型</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除该模型吗？此操作不可恢复。
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
