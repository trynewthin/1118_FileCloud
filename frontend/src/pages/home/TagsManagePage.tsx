import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import { useTagList } from "@/hooks/useTags";
import { TagItem } from "@/components/tag/TagItem";
import { TagEditDialog } from "@/components/tag/TagEditDialog";
import { TagDeleteDialog } from "@/components/tag/TagDeleteDialog";
import type { FileTag } from "@/lib/api/tags";

export const TagsManagePage = () => {
  const { tags, loading, error, create, update, remove } = useTagList();

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
    <PageContainer title="标签管理" className="h-full flex flex-col relative">
      <GlassCard className="px-3 py-2 flex items-center">
        <div className="flex-1 text-sm text-foreground/80">管理你的标签结构</div>
        <GlassButton
          glassVariant="lite"
          size="icon"
          onClick={handleAddRoot}
          title="新建标签"
        >
          <Plus className="h-4 w-4" />
        </GlassButton>
      </GlassCard>

      <GlassCard variant="ghost" className="flex-1 mt-4 min-h-0 overflow-y-auto px-2 py-2">
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
