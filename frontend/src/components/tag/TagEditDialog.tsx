import { useState, useEffect } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { FileTag } from "@/lib/api/tags";

// 预设颜色列表（按暖色 -> 冷色 -> 中性色排列）
export const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#fb923c", // orange-light
  "#eab308", // yellow
  "#22c55e", // green
  "#16a34a", // green-deep
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#2563eb", // blue-deep
  "#8b5cf6", // violet
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f973ab", // pink-light
  "#6b7280", // gray
  "#4b5563", // gray-deep
];

interface TagEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: FileTag | null; // null 表示新建
  parentTag: FileTag | null; // 父标签（新建子标签时使用）
  onSave: (data: {
    name: string;
    color: string | null;
    allowMultiple: boolean;
    parentTagId: number | null;
  }) => Promise<void>;
}

export const TagEditDialog = ({
  open,
  onOpenChange,
  tag,
  parentTag,
  onSave,
}: TagEditDialogProps) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = !tag;
  const isRootLevel = isNew ? !parentTag : tag.level === 1;

  // 当 tag 或 open 变化时重置表单
  useEffect(() => {
    if (!open) return;

    // 名称
    setName(tag?.name || "");

    // 颜色：编辑时沿用原颜色，新建时随机选择一个预设颜色
    if (tag?.color) {
      setColor(tag.color);
    } else {
      const randomIndex = Math.floor(Math.random() * PRESET_COLORS.length);
      setColor(PRESET_COLORS[randomIndex]);
    }

    // 选择模式：编辑时沿用原配置，新建时默认互斥（单选）
    setAllowMultiple(tag?.allow_multiple || false);

    setError(null);
  }, [open, tag]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("标签名称不能为空");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        color,
        allowMultiple: isRootLevel ? allowMultiple : false,
        parentTagId: isNew ? (parentTag?.id ?? null) : (tag?.parent_tag_id ?? null),
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isNew ? (parentTag ? `在「${parentTag.name}」下新建子标签` : "新建标签") : "编辑标签"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 标签名称 */}
          <div className="space-y-2">
            <Label>标签名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入标签名称"
              autoFocus
            />
          </div>

          {/* 颜色选择 */}
          <div className="space-y-2">
            <Label>颜色</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-all",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* 互斥/多选（仅一级标签） */}
          {isRootLevel && (
            <div className="space-y-2">
              <Label>选择模式</Label>
              <div className="flex items-center gap-2">
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                    !allowMultiple ? "border-primary bg-primary/10" : "border-muted"
                  )}
                  onClick={() => setAllowMultiple(false)}
                >
                  <ToggleLeft className="h-4 w-4" />
                  <span className="text-sm">互斥（单选）</span>
                </button>
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                    allowMultiple ? "border-primary bg-primary/10" : "border-muted"
                  )}
                  onClick={() => setAllowMultiple(true)}
                >
                  <ToggleRight className="h-4 w-4" />
                  <span className="text-sm">多选</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {allowMultiple
                  ? "文件可以同时拥有此标签下的多个子标签"
                  : "文件在此标签下只能选择一个子标签（互斥）"}
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
