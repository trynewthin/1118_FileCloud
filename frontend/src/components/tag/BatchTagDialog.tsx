import { useState, useMemo } from "react";
import { Tag, Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/common/dialog/dialog";
import { useTagList } from "@/hooks/useTags";
import { addTagToEntries } from "@/lib/api/tags";
import type { FileTag } from "@/lib/api/tags";

interface BatchTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryIds: string[];
  fileCount: number;
  onSuccess?: () => void;
}

export const BatchTagDialog = ({
  open,
  onOpenChange,
  entryIds,
  fileCount,
  onSuccess,
}: BatchTagDialogProps) => {
  const { tags: allTags, loading: tagsLoading } = useTagList();
  const [operating, setOperating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

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

  // 切换标签选择
  const handleToggleTag = (tag: FileTag) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tag.id)) {
        next.delete(tag.id);
      } else {
        next.add(tag.id);
      }
      return next;
    });
  };

  // 提交批量标签
  const handleSubmit = async () => {
    if (selectedTagIds.size === 0) {
      toast.error("请选择至少一个标签");
      return;
    }
    if (operating) return;

    setOperating(true);
    try {
      // 为每个选中的标签，批量添加到所有文件
      for (const tagId of selectedTagIds) {
        await addTagToEntries(tagId, entryIds);
      }
      toast.success(`已为 ${fileCount} 个文件添加 ${selectedTagIds.size} 个标签`);
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "批量添加标签失败");
    } finally {
      setOperating(false);
    }
  };

  // 渲染标签树
  const renderTagTree = (tags: FileTag[], level: number = 0) => {
    return tags.map((tag) => {
      const isSelected = selectedTagIds.has(tag.id);
      const hasChildren = tag.children && tag.children.length > 0;

      return (
        <div key={tag.id} className={cn(level > 0 && "ml-5")}>
          <div
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all cursor-pointer group",
              isSelected
                ? "bg-primary/10 border border-primary/40"
                : "hover:bg-muted/50 border border-transparent"
            )}
            onClick={() => handleToggleTag(tag)}
          >
            {/* 颜色标记 */}
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: tag.color || "#6b7280" }}
            />

            {/* 标签名称 */}
            <span className={cn("flex-1 text-sm truncate", isSelected && "font-medium")}>
              {tag.name}
            </span>

            {/* 选中状态 */}
            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
          </div>

          {/* 子标签 */}
          {hasChildren && (
            <div className="mt-1">{renderTagTree(tag.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] h-[520px] flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            批量添加标签（{fileCount} 个文件）
          </DialogTitle>
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
            {tagsLoading ? (
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
              <div className="space-y-1">{renderTagTree(filteredTags)}</div>
            )}
          </div>
        </div>

        <DialogFooter
          leftButtonIcon={<X className="h-4 w-4" />}
          onLeftButtonClick={() => {
            if (!operating) {
              onOpenChange(false);
            }
          }}
          leftButtonGlassVariant="lite"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={() => {
            if (!operating) {
              void handleSubmit();
            }
          }}
          rightButtonGlassVariant="lite"
        />
      </DialogContent>
    </Dialog>
  );
};
