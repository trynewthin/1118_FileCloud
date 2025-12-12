import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import type { FileTag } from "@/lib/api/tags";

interface TagItemProps {
  tag: FileTag;
  level?: number;
  onEdit: (tag: FileTag) => void;
  onDelete: (tag: FileTag) => void;
  onAddChild: (parentTag: FileTag) => void;
  showAddChild?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
}

export const TagItem = ({
  tag,
  level = 0,
  onEdit,
  onDelete,
  onAddChild,
  showAddChild = true,
  showEdit = true,
  showDelete = true,
}: TagItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = tag.children && tag.children.length > 0;
  const canAddChild = tag.level < 3;

  const areChildrenAllLeaf = (t: FileTag) => {
    if (!t.children || t.children.length === 0) return false;
    return t.children.every((c) => !c.children || c.children.length === 0);
  };

  return (
    <div className={cn(level > 0 && "ml-7")}>
      <GlassCard
        variant="lite"
        hoverEffect
        className={cn(
          "flex items-center gap-2 py-2 px-3 transition-all cursor-pointer group",
          expanded && hasChildren && "bg-muted/40",
        )}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* 颜色标记 */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: tag.color || "#6b7280" }}
        />

        {/* 标签名称 */}
        <span className={cn("flex-1 min-w-0 truncate text-sm", DS.text.body)}>{tag.name}</span>

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
        <div className="flex items-center justify-end gap-1 min-h-7">
          {showDelete && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(tag);
              }}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {showEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tag);
              }}
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {showAddChild && canAddChild && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(tag);
              }}
              title="添加子标签"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* 展开/收起按钮（移动到最右侧） */}
        <button
          className={cn(
            "w-5 h-5 flex items-center justify-center text-muted-foreground",
            !hasChildren && "invisible"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </GlassCard>

      {/* 子标签 */}
      {hasChildren && expanded && (
        areChildrenAllLeaf(tag) ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tag.children!.map((child) => {
              const childCanAdd = child.level < 3;
              return (
                <button
                  key={child.id}
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg",
                    DS.glass.lite,
                    DS.radius.lg,
                    "border border-white/10 hover:bg-muted/50"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showEdit) {
                      onEdit(child);
                    }
                  }}
                  title={showEdit ? "编辑" : child.name}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: child.color || "#6b7280" }}
                  />
                  <span className={cn("max-w-[160px] truncate text-sm", DS.text.body)}>{child.name}</span>

                  {(showAddChild || showEdit || showDelete) && (
                    <span className="flex items-center gap-0.5 ml-1">
                      {showAddChild && childCanAdd && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onAddChild(child);
                          }}
                          title="添加子标签"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {showEdit && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onEdit(child);
                          }}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {showDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onDelete(child);
                          }}
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {tag.children!.map((child) => (
              <TagItem
                key={child.id}
                tag={child}
                level={level + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                showAddChild={showAddChild}
                showEdit={showEdit}
                showDelete={showDelete}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
};
