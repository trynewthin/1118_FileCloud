import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassButtonGroup } from "@/components/common/GlassButtonGroup";
import { Button } from "@/components/ui/button";
import { useTagList } from "@/hooks/useTags";
import { TagItem } from "@/components/tag/TagItem";
import { TagEditDialog } from "@/components/tag/TagEditDialog";
import { TagDeleteDialog } from "@/components/tag/TagDeleteDialog";
import type { FileTag } from "@/lib/api/tags";

export const TagsManagePage = () => {
  const { tags, loading, error, create, update, remove } = useTagList();

  const [showAddChild, setShowAddChild] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tags_manage_action_visibility");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { showAddChild?: boolean; showEdit?: boolean; showDelete?: boolean };
      if (typeof parsed.showAddChild === "boolean") setShowAddChild(parsed.showAddChild);
      if (typeof parsed.showEdit === "boolean") setShowEdit(parsed.showEdit);
      if (typeof parsed.showDelete === "boolean") setShowDelete(parsed.showDelete);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "tags_manage_action_visibility",
        JSON.stringify({ showAddChild, showEdit, showDelete })
      );
    } catch {
      // ignore
    }
  }, [showAddChild, showEdit, showDelete]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<FileTag | null>(null);
  const [parentTagForNew, setParentTagForNew] = useState<FileTag | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<FileTag | null>(null);

  const handleAddRoot = () => {
    setEditingTag(null);
    setParentTagForNew(null);
    setEditDialogOpen(true);
  };

  const handleAddChild = (parentTag: FileTag) => {
    setEditingTag(null);
    setParentTagForNew(parentTag);
    setEditDialogOpen(true);
  };

  const handleEdit = (tag: FileTag) => {
    setEditingTag(tag);
    setParentTagForNew(null);
    setEditDialogOpen(true);
  };

  const handleDelete = (tag: FileTag) => {
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    color: string | null;
    allowMultiple: boolean;
    showAncestorChain: boolean;
    parentTagId: number | null;
  }) => {
    if (editingTag) {
      await update(editingTag.id, {
        name: data.name,
        color: data.color,
        allowMultiple: data.allowMultiple,
        showAncestorChain: data.showAncestorChain,
      });
      toast.success("标签已更新");
    } else {
      await create({
        name: data.name,
        color: data.color,
        allowMultiple: data.allowMultiple,
        showAncestorChain: data.showAncestorChain,
        parentTagId: data.parentTagId,
      });
      toast.success("标签已创建");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    await remove(deletingTag.id);
    toast.success("标签已删除");
  };

  return (
    <PageContainer
      title="标签管理"
      className="h-full flex flex-col relative"
      action={
        <div className="flex items-center gap-2">
          <GlassButton
            glassVariant="lite"
            className="h-8 px-3 text-sm justify-start min-w-[96px]"
            onClick={handleAddRoot}
            title="添加标签"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1">添加标签</span>
          </GlassButton>

          <GlassButtonGroup glassVariant="lite" className="p-0.5 gap-0.5">
            <Button
              variant={showAddChild ? "secondary" : "ghost"}
              size="icon-sm"
              className={showAddChild ? "h-8 w-8 text-foreground" : "h-8 w-8 text-muted-foreground"}
              onClick={() => setShowAddChild((v) => !v)}
              title={showAddChild ? "隐藏新增子标签按钮" : "显示新增子标签按钮"}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant={showEdit ? "secondary" : "ghost"}
              size="icon-sm"
              className={showEdit ? "h-8 w-8 text-foreground" : "h-8 w-8 text-muted-foreground"}
              onClick={() => setShowEdit((v) => !v)}
              title={showEdit ? "隐藏编辑按钮" : "显示编辑按钮"}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant={showDelete ? "secondary" : "ghost"}
              size="icon-sm"
              className={showDelete ? "h-8 w-8 text-foreground" : "h-8 w-8 text-muted-foreground"}
              onClick={() => setShowDelete((v) => !v)}
              title={showDelete ? "隐藏删除按钮" : "显示删除按钮"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </GlassButtonGroup>
        </div>
      }
    >
      <GlassCard variant="ghost" className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-destructive text-sm">{error}</div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <p>暂无标签</p>
            <p className="text-xs">点击右上角 + 创建标签</p>
          </div>
        ) : (
          <div className="space-y-1">
            {tags.map((tag) => (
              <TagItem
                key={tag.id}
                tag={tag}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
                showAddChild={showAddChild}
                showEdit={showEdit}
                showDelete={showDelete}
              />
            ))}
          </div>
        )}
      </GlassCard>

      <TagEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tag={editingTag}
        parentTag={parentTagForNew}
        onSave={handleSave}
      />

      <TagDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        tag={deletingTag}
        onConfirm={handleConfirmDelete}
      />
    </PageContainer>
  );
};
