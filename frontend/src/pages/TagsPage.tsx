import { useState } from "react";
import { toast } from "sonner";
import { Tag, Plus, Pencil, Trash2, ChevronRight, ChevronDown, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "../lib/utils";
import { DS } from "../lib/design-system";
import { PageContainer } from "../components/layout/PageContainer";
import { GlassCard } from "../components/common/GlassCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { useTagList } from "../hooks/useTags";
import type { FileTag } from "../lib/api/tags";

// 预设颜色列表
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

// 标签项组件
const TagItem = ({
  tag,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
}: {
  tag: FileTag;
  level?: number;
  onEdit: (tag: FileTag) => void;
  onDelete: (tag: FileTag) => void;
  onAddChild: (parentTag: FileTag) => void;
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = tag.children && tag.children.length > 0;
  const canAddChild = tag.level < 3;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group",
          level > 0 && "ml-6"
        )}
      >
        {/* 展开/收起按钮 */}
        <button
          className={cn(
            "w-5 h-5 flex items-center justify-center text-muted-foreground",
            !hasChildren && "invisible"
          )}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* 颜色标记 */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: tag.color || "#6b7280" }}
        />

        {/* 标签名称 */}
        <span className={cn("flex-1 text-sm", DS.text.body)}>{tag.name}</span>

        {/* 互斥/多选标记（仅一级标签） */}
        {tag.level === 1 && (
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {tag.allow_multiple ? "多选" : "互斥"}
          </span>
        )}

        {/* 文件数量 */}
        {tag.entry_count !== undefined && tag.entry_count > 0 && (
          <span className="text-xs text-muted-foreground">{tag.entry_count}</span>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canAddChild && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onAddChild(tag)}
              title="添加子标签"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={() => onEdit(tag)}
            title="编辑"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(tag)}
            title="删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 子标签 */}
      {hasChildren && expanded && (
        <div>
          {tag.children!.map((child) => (
            <TagItem
              key={child.id}
              tag={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 标签编辑对话框
const TagEditDialog = ({
  open,
  onOpenChange,
  tag,
  parentTag,
  allTags,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: FileTag | null; // null 表示新建
  parentTag: FileTag | null; // 父标签（新建子标签时使用）
  allTags: FileTag[];
  onSave: (data: {
    name: string;
    color: string | null;
    allowMultiple: boolean;
    parentTagId: number | null;
  }) => Promise<void>;
}) => {
  const [name, setName] = useState(tag?.name || "");
  const [color, setColor] = useState(tag?.color || PRESET_COLORS[0]);
  const [allowMultiple, setAllowMultiple] = useState(tag?.allow_multiple || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = !tag;
  const isRootLevel = isNew ? !parentTag : tag.level === 1;

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

  // 重置表单
  const resetForm = () => {
    setName(tag?.name || "");
    setColor(tag?.color || PRESET_COLORS[0]);
    setAllowMultiple(tag?.allow_multiple || false);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
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

// 删除确认对话框
const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  tag,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: FileTag | null;
  onConfirm: () => Promise<void>;
}) => {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>删除标签</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            确定要删除标签「{tag?.name}」吗？
            {tag?.children && tag.children.length > 0 && (
              <span className="text-destructive">
                {" "}此操作将同时删除所有子标签。
              </span>
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "删除中..." : "删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 主页面
export const TagsPage = () => {
  const { tags, loading, error, create, update, remove, reload } = useTagList();
  
  // 对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<FileTag | null>(null);
  const [parentTagForNew, setParentTagForNew] = useState<FileTag | null>(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<FileTag | null>(null);

  // 新建标签
  const handleAddRoot = () => {
    setEditingTag(null);
    setParentTagForNew(null);
    setEditDialogOpen(true);
  };

  // 新建子标签
  const handleAddChild = (parentTag: FileTag) => {
    setEditingTag(null);
    setParentTagForNew(parentTag);
    setEditDialogOpen(true);
  };

  // 编辑标签
  const handleEdit = (tag: FileTag) => {
    setEditingTag(tag);
    setParentTagForNew(null);
    setEditDialogOpen(true);
  };

  // 删除标签
  const handleDelete = (tag: FileTag) => {
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  };

  // 保存标签
  const handleSave = async (data: {
    name: string;
    color: string | null;
    allowMultiple: boolean;
    parentTagId: number | null;
  }) => {
    if (editingTag) {
      await update(editingTag.id, {
        name: data.name,
        color: data.color,
        allowMultiple: data.allowMultiple,
      });
      toast.success("标签已更新");
    } else {
      await create({
        name: data.name,
        color: data.color,
        allowMultiple: data.allowMultiple,
        parentTagId: data.parentTagId,
      });
      toast.success("标签已创建");
    }
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    await remove(deletingTag.id);
    toast.success("标签已删除");
  };

  return (
    <PageContainer
      title="标签管理"
      action={
        <Button size="sm" onClick={handleAddRoot}>
          <Plus className="h-4 w-4 mr-1" />
          新建标签
        </Button>
      }
    >
      <GlassCard variant="lite" className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              加载中...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-32 text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && tags.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
              <Tag className="h-8 w-8" />
              <p>暂无标签</p>
              <Button variant="outline" size="sm" onClick={handleAddRoot}>
                创建第一个标签
              </Button>
            </div>
          )}

          {!loading && !error && tags.length > 0 && (
            <div className="space-y-1">
              {tags.map((tag) => (
                <TagItem
                  key={tag.id}
                  tag={tag}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onAddChild={handleAddChild}
                />
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* 编辑对话框 */}
      <TagEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tag={editingTag}
        parentTag={parentTagForNew}
        allTags={tags}
        onSave={handleSave}
      />

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        tag={deletingTag}
        onConfirm={handleConfirmDelete}
      />
    </PageContainer>
  );
};

export default TagsPage;
