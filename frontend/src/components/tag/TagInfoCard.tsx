import { useMemo, useEffect } from "react";
import { Tag as TagIcon } from "lucide-react";
import { DelayedLoader } from "@/components/common";
import { useEntryTags, useTagList, getTagPath, flattenTags } from "@/hooks/useTags";
import type { FileTag } from "@/lib/api/tags";

interface TagInfoCardProps {
  entryId: string;
  /** 刷新标识，变化时会重新加载标签 */
  refreshKey?: number;
}

// 文件预览页的标签展示泳道（无卡片背景，横向自动换行）
export const TagInfoCard = ({ entryId, refreshKey }: TagInfoCardProps) => {
  const { tags, loading, error, reload: reloadEntryTags } = useEntryTags(entryId);
  const { tags: allTags, reload: reloadAllTags } = useTagList();

  // refreshKey 变化时重新加载
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      reloadEntryTags();
      reloadAllTags();
    }
  }, [refreshKey, reloadEntryTags, reloadAllTags]);

  // 扁平化标签列表，用于查找一级标签
  const flatTags = useMemo(() => flattenTags(allTags), [allTags]);

  // 获取标签所属的一级标签（从 allTags 中查找，因为需要获取一级标签的 show_ancestor_chain 配置）
  const getRootTag = (tag: FileTag): FileTag | null => {
    // 如果是一级标签，从 allTags 中查找以获取最新配置
    if (tag.level === 1) {
      return flatTags.find((t) => t.id === tag.id) ?? tag;
    }
    // 向上查找父标签
    let currentParentId = tag.parent_tag_id;
    while (currentParentId !== null) {
      const parent = flatTags.find((t) => t.id === currentParentId);
      if (!parent) return null;
      if (parent.level === 1) return parent;
      currentParentId = parent.parent_tag_id;
    }
    return null;
  };

  // 获取标签显示文本（根据一级标签的 show_ancestor_chain 配置决定是否显示祖先链）
  const getTagDisplayText = (tag: FileTag) => {
    if (tag.level === 1) {
      // 一级标签直接显示名称
      return tag.name;
    }
    // 查找一级标签的配置
    const rootTag = getRootTag(tag);
    if (rootTag?.show_ancestor_chain) {
      // 显示完整路径
      return getTagPath(tag, allTags);
    }
    return tag.name;
  };

  // 解析标签颜色，返回背景色和文字色
  const getTagColors = (color: string | null) => {
    if (!color) {
      return {
        backgroundColor: "hsl(var(--muted))",
        // 默认标签文字使用前景色的稍弱版本，保证可读性
        color: "hsl(var(--foreground) / 0.8)",
      };
    }
    // 使用标签自带颜色作为背景，文字使用对比色
    return {
      backgroundColor: `${color}20`, // 20% 透明度
      color: color,
    };
  };

  return (
    <DelayedLoader
      loading={loading}
      fallback={
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <span className="w-4 h-4 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin" />
          加载标签中...
        </div>
      }
    >
      {error ? (
        <div className="text-sm text-destructive">标签加载失败</div>
      ) : tags.length === 0 ? (
        <></>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((et) => {
            const colors = getTagColors(et.tag.color);
            return (
              <span
                key={et.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                style={colors}
              >
                <TagIcon className="w-3 h-3" />
                {getTagDisplayText(et.tag)}
              </span>
            );
          })}
        </div>
      )}
    </DelayedLoader>
  );
};
