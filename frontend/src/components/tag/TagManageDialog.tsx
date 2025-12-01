import { useState } from "react";
import { toast } from "sonner";
import { Tag, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GlassButton } from "@/components/common/GlassButton";
import { useTagList } from "@/hooks/useTags";
import { TagItem } from "./TagItem";
import { TagEditDialog } from "./TagEditDialog";
import { TagDeleteDialog } from "./TagDeleteDialog";
import type { FileTag } from "@/lib/api/tags";

interface TagManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TagManageDialog = ({ open, onOpenChange }: TagManageDialogProps) => {
  const { tags, loading, error, create, update, remove } = useTagList();

  // 编辑/新建对话框状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<FileTag | null>(null);
  const [parentTagForNew, setParentTagForNew] = useState<FileTag | null>(null);

  // 删除对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<FileTag | null>(null);

  // 新建根标签
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[480px] h-[560px] flex flex-col"
          showCloseButton={false}
          rightButton={
            <GlassButton
              glassVariant="ghost"
              size="icon"
              onClick={handleAddRoot}
              title="新建标签"
            >
              <Plus className="h-4 w-4" />
            </GlassButton>
          }
        >
          <DialogHeader>
            <DialogTitle>标签管理</DialogTitle>
          </DialogHeader>

          {/* 标签列表 */}
          <div className="flex-1 min-h-0 overflow-hidden border rounded-md bg-muted/30">
            <div className="h-full overflow-y-auto p-3">
              {loading && (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  加载中...
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-full text-destructive text-sm">
                  {error}
                </div>
              )}

              {!loading && !error && tags.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                  <Tag className="h-8 w-8" />
                  <p>暂无标签</p>
                  <p className="text-xs">点击右上角 + 创建标签</p>
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
          </div>

          <DialogFooter
            leftButtonIcon={<X className="h-4 w-4" />}
            onLeftButtonClick={() => onOpenChange(false)}
            leftButtonGlassVariant="lite"
          />
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <TagEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tag={editingTag}
        parentTag={parentTagForNew}
        onSave={handleSave}
      />

      {/* 删除确认对话框 */}
      <TagDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        tag={deletingTag}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
