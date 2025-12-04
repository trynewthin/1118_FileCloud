import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import type { FileTag } from "@/lib/api/tags";

interface TagItemProps {
  tag: FileTag;
  level?: number;
  onEdit: (tag: FileTag) => void;
  onDelete: (tag: FileTag) => void;
  onAddChild: (parentTag: FileTag) => void;
}

export const TagItem = ({
  tag,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
}: TagItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = tag.children && tag.children.length > 0;
  const canAddChild = tag.level < 3;

  return (
    <div className={cn(level > 0 && "ml-7")}>    
      <GlassCard
        variant="lite"
        hoverEffect
        className="flex items-center gap-2 py-2 px-3 group"
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
        <div className="flex items-center gap-1">
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
      </GlassCard>

      {/* 子标签 */}
      {hasChildren && expanded && (
        <div className="mt-2 space-y-1.5">
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
