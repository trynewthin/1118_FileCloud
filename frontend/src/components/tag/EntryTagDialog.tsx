import { useState, useMemo, useLayoutEffect, useRef, useEffect } from "react";
import { Check, Search, X, Tag, ChevronRight, ChevronDown, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/common/dialog/dialog";
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
  const [primaryMode, setPrimaryMode] = useState(false);

  const expandedBeforeSearchRef = useRef<Set<number> | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingRestoreScrollTopRef = useRef<number | null>(null);

  // 当前文件已关联的标签 ID 集合
  const entryTagIdSet = useMemo(() => new Set(entryTags.map((t) => t.tag_id)), [entryTags]);
  const primaryTagId = useMemo(() => {
    return entryTags.find((t) => t.is_primary)?.tag_id ?? null;
  }, [entryTags]);

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

  // 搜索时自动展开：把过滤后树里所有“仍有子节点”的标签都展开，确保路径展开到命中项
  const collectExpandableIds = (tags: FileTag[]) => {
    const ids = new Set<number>();
    const walk = (list: FileTag[]) => {
      for (const t of list) {
        if (t.children && t.children.length > 0) {
          ids.add(t.id);
          walk(t.children);
        }
      }
    };
    walk(tags);
    return ids;
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length > 0) {
      if (!expandedBeforeSearchRef.current) {
        expandedBeforeSearchRef.current = new Set(expandedIds);
      }
      setExpandedIds(collectExpandableIds(filteredTags));
      return;
    }

    // 清空搜索：恢复用户之前的展开状态（默认仍为折叠）
    if (expandedBeforeSearchRef.current) {
      setExpandedIds(expandedBeforeSearchRef.current);
      expandedBeforeSearchRef.current = null;
    }
  }, [searchQuery, filteredTags]);

  // 切换标签
  const handleToggleTag = async (tag: FileTag) => {
    if (operating) return;
    pendingRestoreScrollTopRef.current = scrollRef.current?.scrollTop ?? null;
    setOperating(true);
    try {
      if (entryTagIdSet.has(tag.id)) {
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

  const handleSetPrimary = async (tag: FileTag) => {
    if (operating) return;
    pendingRestoreScrollTopRef.current = scrollRef.current?.scrollTop ?? null;
    setOperating(true);
    try {
      if (!entryTagIdSet.has(tag.id)) {
        await addTag(tag.id, true);
      } else if (primaryTagId !== tag.id) {
        await setAsPrimary(tag.id);
      }
      toast.success(`已设置「${tag.name}」为主标签`);
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    } finally {
      setOperating(false);
    }
  };

  useLayoutEffect(() => {
    if (operating) return;
    const top = pendingRestoreScrollTopRef.current;
    if (top === null) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = top;
    pendingRestoreScrollTopRef.current = null;
  }, [entryTags, operating]);

  // 判断某个标签的子标签是否全部为叶子节点（即子标签不存在子标签）
  const areChildrenAllLeaf = (tag: FileTag) => {
    if (!tag.children || tag.children.length === 0) return false;
    return tag.children.every((c) => !c.children || c.children.length === 0);
  };

  const renderLeafLane = (children: FileTag[]) => {
    return (
      <div className={cn("flex flex-wrap gap-1.5 py-1")}> 
        {children.map((child) => {
          const isSelected = entryTagIdSet.has(child.id);
          const isPrimary = primaryTagId === child.id;
          return (
            <button
              key={child.id}
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                DS.glass.lite,
                DS.radius.full,
                isPrimary && "bg-yellow-500/15 border-yellow-400/70",
                isSelected
                  ? "bg-primary/12 border-primary/45 text-foreground"
                  : "bg-background/10 border-white/10 text-foreground/80 hover:text-foreground"
              )}
              onClick={() => (primaryMode ? handleSetPrimary(child) : handleToggleTag(child))}
              title={primaryMode ? "点击设为主标签" : (isSelected ? "点击移除" : "点击添加")}
              disabled={operating}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: child.color || "#6b7280" }}
              />
              <span className="truncate max-w-[220px]">{child.name}</span>
              {primaryMode ? (
                <Star className={cn("h-3.5 w-3.5", isPrimary ? "text-yellow-500 fill-yellow-500" : "text-foreground/60")} />
              ) : (
                isSelected ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Plus className="h-3.5 w-3.5 text-foreground/60" />
                )
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // 渲染标签树：
  // - 默认列表样式（更紧凑）
  // - 若某个标签的子标签全部为叶子节点，则展开后用“泳道”展示这些子标签
  const renderTagTree = (tags: FileTag[], level: number = 0) => {
    return tags.map((tag) => {
      const isSelected = entryTagIdSet.has(tag.id);
      const isPrimary = primaryTagId === tag.id;
      const hasChildren = !!tag.children && tag.children.length > 0;
      const isExpanded = hasChildren && expandedIds.has(tag.id);
      const useLane = hasChildren && areChildrenAllLeaf(tag);

      return (
        <div key={tag.id} className={cn(level > 0 && "ml-7")}>
          <div
            className={cn(
              "flex items-center gap-2 py-1.5 px-2.5 transition-colors",
              DS.glass.lite,
              DS.radius.xl,
              hasChildren ? "cursor-pointer" : "cursor-default",
              isPrimary && "bg-yellow-500/15 border-yellow-400/70",
              isSelected ? "bg-primary/10 border-primary/40" : "hover:bg-muted/50"
            )}
            onClick={() => {
              if (hasChildren) {
                toggleExpand(tag.id);
              }
            }}
          >
            {/* 折叠/展开按钮 */}
            {hasChildren ? (
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(tag.id);
                }}
                title={isExpanded ? "收起" : "展开"}
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

            {/* 标签名称 */}
            {hasChildren ? (
              <div className="flex-1 min-w-0 text-left">
                <span className={cn("truncate text-sm", isSelected && "font-medium")}>{tag.name}</span>
              </div>
            ) : (
              <button
                type="button"
                className="flex-1 min-w-0 text-left"
                onClick={() => {
                  if (primaryMode) {
                    handleSetPrimary(tag);
                  } else {
                    handleToggleTag(tag);
                  }
                }}
                disabled={operating}
                title={primaryMode ? "点击设为主标签" : (isSelected ? "点击移除" : "点击添加")}
              >
                <span className={cn("truncate text-sm", isSelected && "font-medium")}>{tag.name}</span>
              </button>
            )}

            {/* 叶子节点提供快速添加/移除按钮（更高效） */}
            {!hasChildren && (
              <button
                type="button"
                className="p-1 hover:bg-muted rounded shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (primaryMode) {
                    handleSetPrimary(tag);
                  } else {
                    handleToggleTag(tag);
                  }
                }}
                title={primaryMode ? "设为主标签" : (isSelected ? "移除标签" : "添加标签")}
                disabled={operating}
              >
                {primaryMode ? (
                  <Star className={cn("h-4 w-4", isPrimary ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground")} />
                ) : (
                  isSelected ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )
                )}
              </button>
            )}
          </div>

          {/* 子标签 */}
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {useLane
                ? renderLeafLane(tag.children!)
                : <div className="space-y-1">{renderTagTree(tag.children!, level + 1)}</div>}
            </div>
          )}
        </div>
      );
    });
  };

  const loading = tagsLoading;
  const updating = operating || entryTagsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] h-[520px] flex flex-col" showCloseButton>
        <DialogHeader className="items-start text-left">
          <DialogTitle className="text-left">管理标签</DialogTitle>
        </DialogHeader>

        {/* 标签列表 */}
        <div className="relative flex-1 min-h-0 overflow-hidden border rounded-md bg-muted/30">
          <div ref={scrollRef} className="h-full overflow-y-auto p-3">
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

          {updating && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-4 h-4 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin" />
                更新中...
              </div>
            </div>
          )}
        </div>

        {/* 底部：搜索 + 模式切换 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/70" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标签..."
              className="pl-9 pr-8 bg-background/50 dark:bg-background/30 border-white/25 dark:border-white/15 placeholder:text-foreground/55 dark:placeholder:text-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/35"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                onClick={() => setSearchQuery("")}
                title="清空搜索"
              >
                <X className="h-3.5 w-3.5 text-foreground/70" />
              </button>
            )}
          </div>

          <button
            type="button"
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center rounded-md border transition-colors",
              DS.glass.lite,
              DS.radius.lg,
              primaryMode
                ? "bg-yellow-500/15 border-yellow-400/70"
                : "bg-background/45 dark:bg-background/25 border-white/25 dark:border-white/15 hover:bg-muted/50"
            )}
            onClick={() => setPrimaryMode((v) => !v)}
            title={primaryMode ? "当前：设置主标签" : "当前：添加/移除标签"}
            disabled={operating}
          >
            <Star
              className={cn(
                "h-4 w-4",
                primaryMode ? "text-yellow-500 fill-yellow-500" : "text-foreground/75"
              )}
            />
          </button>
        </div>

        {/* 已选标签预览已移除 */}
      </DialogContent>
    </Dialog>
  );
};
