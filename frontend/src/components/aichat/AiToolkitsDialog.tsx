import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AiChatConversation, ToolKitListItem, ToolKitsConfig } from "@/lib/api/aiChat";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/common/dialog/dialog";
import { GlassCard } from "@/components/common/GlassCard";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { Check, RotateCcw, Save, XIcon } from "lucide-react";

interface AiToolkitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: AiChatConversation | null;
  toolkits: ToolKitListItem[];
  loadingToolkits: boolean;
  onSave: (config: ToolKitsConfig | null) => Promise<void>;
}

export function AiToolkitsDialog({
  open,
  onOpenChange,
  conversation,
  toolkits,
  loadingToolkits,
  onSave,
}: AiToolkitsDialogProps) {
  const sortedToolkits = useMemo(() => {
    return [...toolkits].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }, [toolkits]);

  const initialConfig = (conversation?.metadata as any)?.toolkitsConfig as ToolKitsConfig | undefined;

  const [mode, setMode] = useState<ToolKitsConfig["mode"]>(initialConfig?.mode ?? "inherit");
  const [disabledKeys, setDisabledKeys] = useState<Set<string>>(new Set(initialConfig?.disabled ?? []));
  const [enabledKeys, setEnabledKeys] = useState<Set<string>>(
    new Set(
      initialConfig?.enabled ??
        toolkits
          .filter((t) => t.defaultEnabled)
          .map((t) => t.key),
    ),
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const cfg = (conversation?.metadata as any)?.toolkitsConfig as ToolKitsConfig | undefined;
    setMode(cfg?.mode ?? "inherit");
    setDisabledKeys(new Set(cfg?.disabled ?? []));
    setEnabledKeys(
      new Set(
        cfg?.enabled ??
          toolkits
            .filter((t) => t.defaultEnabled)
            .map((t) => t.key),
      ),
    );
  }, [open, conversation?.id, toolkits]);

  const handleToggle = (key: string, nextChecked: boolean) => {
    if (mode === "inherit") {
      const tk = toolkits.find((t) => t.key === key);
      if (!tk?.defaultEnabled) return;

      setDisabledKeys((prev) => {
        const next = new Set(prev);
        if (nextChecked) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      return;
    }

    setEnabledKeys((prev) => {
      const next = new Set(prev);
      if (nextChecked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const buildSavePayload = (): ToolKitsConfig | null => {
    if (mode === "inherit") {
      const disabled = Array.from(disabledKeys);
      if (disabled.length === 0) {
        return null;
      }
      return { mode: "inherit", disabled };
    }

    return {
      mode: "override",
      enabled: Array.from(enabledKeys),
    };
  };

  const handleSave = async () => {
    if (!conversation || saving) return;

    setSaving(true);
    try {
      const payload = buildSavePayload();
      await onSave(payload);
      toast.success("已保存工具包配置");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (saving) return;
    setMode("inherit");
    setDisabledKeys(new Set());
    setEnabledKeys(
      new Set(
        toolkits
          .filter((t) => t.defaultEnabled)
          .map((t) => t.key),
      ),
    );
  };

  const title = conversation
    ? `工具包设置（会话 #${conversation.id}）`
    : "工具包设置";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0! gap-0! sm:max-w-[720px]" showCloseButton={false}>
        <GlassCard variant="strong" className="p-4 sm:p-5 border-white/10">
          <DialogHeader className="space-y-2">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              选择本会话允许 AI 使用的工具包。默认模式下按系统配置启用；也可以切换为“自定义”并手动勾选。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className={cn("text-sm", DS.text.subheading)}>配置模式</div>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as ToolKitsConfig["mode"])}
              >
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">默认（继承系统）</SelectItem>
                  <SelectItem value="override">自定义（仅启用勾选项）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {loadingToolkits ? (
                <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">
                  正在加载工具包...
                </div>
              ) : sortedToolkits.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  当前没有可用工具包
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedToolkits.map((tk) => {
                    const inheritChecked = tk.defaultEnabled && !disabledKeys.has(tk.key);
                    const overrideChecked = enabledKeys.has(tk.key);

                    const checked = mode === "inherit" ? inheritChecked : overrideChecked;

                    const disabled =
                      saving ||
                      (mode === "inherit" && !tk.defaultEnabled);

                    return (
                      <div
                        key={tk.key}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-3",
                          "button-rect:rounded-xl",
                          DS.glass.lite,
                        )}
                      >
                        <div className="min-w-0">
                          <div className={cn("flex items-center gap-2", DS.text.heading)}>
                            <span className="truncate text-sm">{tk.displayName}</span>
                            {tk.defaultEnabled ? (
                              <span className="text-[10px] text-primary/90 bg-primary/10 px-2 py-0.5 rounded-full">
                                默认启用
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full">
                                默认关闭
                              </span>
                            )}
                            {tk.requiredPermission ? (
                              <span className="text-[10px] text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full">
                                权限：{tk.requiredPermission}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {tk.description}（{tk.toolCount} 个工具）
                          </div>
                          {mode === "inherit" && !tk.defaultEnabled ? (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              默认模式下无法启用此工具包，请切换到“自定义”模式。
                            </div>
                          ) : null}
                        </div>

                        <Switch
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) => handleToggle(tk.key, Boolean(v))}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter
            className="mt-4"
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => {
              if (!saving) onOpenChange(false);
            }}
            rightButtonIcon={<Save className="h-4 w-4" />}
            onRightButtonClick={handleSave}
            rightButtonGlassVariant="strong"
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors",
                saving && "pointer-events-none opacity-50",
              )}
              onClick={handleReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              恢复默认
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5" />
              保存后下次对话生效
            </div>
          </DialogFooter>
        </GlassCard>
      </DialogContent>
    </Dialog>
  );
}
