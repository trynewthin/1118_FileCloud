import { useState, useMemo } from "react";
import { Check, Star, Search, X, Tag, ChevronRight, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTagList, useEntryTags } from "@/hooks/useTags";
import type { FileTag } from "@/lib/api/tags";

interface EntryTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
}

export const EntryTagDialog = ({
  open,
  onOpenChange,
  entryId,
}: EntryTagDialogProps) => {
  const { tags: allTags, loading: tagsLoading } = useTagList();
  const { tags: entryTags, loading: entryTagsLoading, addTag, removeTag, setAsPrimary } = useEntryTags(entryId);
  const [operating, setOperating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // 展开状态：默认全部折叠
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // 当前文件已关联的标签 ID 集合
  const entryTagIds = new Set(entryTags.map((t) => t.tag_id));
  // 当前文件的主标签 ID
  const primaryTagId = entryTags.find((t) => t.is_primary)?.tag_id ?? null;

  // 切换展开状态
  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 过滤标签（搜索）
  const filterTags = (tags: FileTag[], query: string): FileTag[] => {
    if (!query.trim()) return tags;
    const lowerQuery = query.toLowerCase();
    return tags.reduce<FileTag[]>((acc, tag) => {
      const matchesSelf = tag.name.toLowerCase().includes(lowerQuery);
      const filteredChildren = tag.children ? filterTags(tag.children, query) : [];
      if (matchesSelf || filteredChildren.length > 0) {
        acc.push({
          ...tag,
          children: matchesSelf ? tag.children : filteredChildren,
        });
      }
      return acc;
    }, []);
  };

  const filteredTags = useMemo(() => filterTags(allTags, searchQuery), [allTags, searchQuery]);

  // 切换标签
  const handleToggleTag = async (tag: FileTag) => {
    if (operating) return;
    setOperating(true);
    try {
      if (entryTagIds.has(tag.id)) {
        await removeTag(tag.id);
        toast.success(`已移除标签「${tag.name}」`);
      } else {
        await addTag(tag.id, false);
        toast.success(`已添加标签「${tag.name}」`);
      }
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    } finally {
      setOperating(false);
    }
  };

  // 设置为主标签
  const handleSetPrimary = async (tag: FileTag) => {
    if (operating) return;
    if (!entryTagIds.has(tag.id)) {
      // 如果还没关联，先添加再设为主标签
      setOperating(true);
      try {
        await addTag(tag.id, true);
        toast.success(`已设置「${tag.name}」为主标签`);
      } catch (err: any) {
        toast.error(err.message || "操作失败");
      } finally {
        setOperating(false);
      }
    } else if (primaryTagId !== tag.id) {
      setOperating(true);
      try {
        await setAsPrimary(tag.id);
        toast.success(`已设置「${tag.name}」为主标签`);
      } catch (err: any) {
        toast.error(err.message || "操作失败");
      } finally {
        setOperating(false);
      }
    }
  };

  // 渲染标签树
  const renderTagTree = (tags: FileTag[], level: number = 0) => {
    return tags.map((tag) => {
      const isSelected = entryTagIds.has(tag.id);
      const isPrimary = primaryTagId === tag.id;
      const hasChildren = tag.children && tag.children.length > 0;
      const isExpanded = hasChildren && expandedIds.has(tag.id);

      return (
        <div key={tag.id} className={cn(level > 0 && "ml-7")}>
          <div
            className={cn(
              "flex items-center gap-2 py-2 px-3 rounded-2xl transition-all cursor-default group bg-background/60 border border-border shadow-sm",
              isPrimary
                ? "bg-yellow-500/15 border border-yellow-400/70 shadow-sm"
                : isSelected
                  ? "bg-primary/10 border border-primary/40"
                  : "hover:bg-muted/50 border border-transparent"
            )}
          >
            {/* 折叠/展开按钮 */}
            {hasChildren ? (
              <button
                className="p-0.5 rounded hover:bg-muted shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(tag.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {/* 颜色标记 */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color || "#6b7280" }}
            />

            {/* 标签名称 + 主标签徽标 */}
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              {isPrimary && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-500 text-yellow-950 shrink-0">
                  主
                </span>
              )}
              <span className={cn("truncate text-sm", (isSelected || isPrimary) && "font-medium")}>{tag.name}</span>
            </div>

            {/* 操作区域：设为主标签 + 添加/移除 */}
            <div className="flex items-center gap-1 ml-1">
              {/* 主标签星标：当前就是主标签时展示 */}
              {isPrimary ? (
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
              ) : (
                isSelected && (
                  <button
                    className="p-1 hover:bg-muted rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(tag);
                    }}
                    title="设为主标签"
                  >
                    <Star className="h-3.5 w-3.5 text-muted-foreground hover:text-yellow-500" />
                  </button>
                )
              )}

              {/* 添加/移除标签按钮 */}
              <button
                className="p-1 hover:bg-muted rounded shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTag(tag);
                }}
                title={isSelected ? "移除标签" : "添加标签"}
              >
                {isSelected ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* 子标签 */}
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderTagTree(tag.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const loading = tagsLoading || entryTagsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] h-[520px] flex flex-col" showCloseButton>
        <DialogHeader className="items-start text-left">
          <DialogTitle className="text-left">管理标签</DialogTitle>
        </DialogHeader>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标签..."
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* 标签列表 */}
        <div className="flex-1 min-h-0 overflow-hidden border rounded-md bg-muted/30">
          <div className="h-full overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                加载中...
              </div>
            ) : allTags.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                <Tag className="h-8 w-8" />
                <p>暂无标签</p>
                <p className="text-xs">请先在标签管理页面创建标签</p>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                未找到匹配的标签
              </div>
            ) : (
              <div className="space-y-1">
                {renderTagTree(filteredTags)}
              </div>
            )}
          </div>
        </div>

        {/* 已选标签预览已移除 */}
      </DialogContent>
    </Dialog>
  );
};
