import { useCallback, useEffect, useState } from "react";
import { Tag, ChevronDown, ChevronRight } from "lucide-react";
import { GlassButton } from "@/components/common/GlassButton";
import { FileGridItem } from "@/components/filebrowsepage";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";
import type { FileTag } from "@/lib/api/tags";
import type { FileEntry } from "@/lib/api/files";
import { getEntriesForTag } from "@/lib/api/tags";
import { getEntry } from "@/lib/api/files";

// 平铺模式下的分组数据结构
interface FlatGroup {
  tag: FileTag;
  path: string; // 完整路径，例如 "标签A / 子标签B"
  files: FileEntry[];
}

interface TagFlatViewProps {
  // 所有标签树数据
  tags: FileTag[];
  // 标签是否在加载中
  tagsLoading: boolean;
  // 打开标签管理
  onOpenManage: () => void;
  // 文件点击及操作回调
  onFileAction: (action: string, entry: FileEntry) => void;
  // 是否只显示主标签为当前标签的文件
  onlyPrimary: boolean;
}

// 递归收集标签及其子标签（深度优先），返回带路径的标签列表
const collectTagsWithPath = (tagList: FileTag[], parentPath: string = ""): { tag: FileTag; path: string }[] => {
  const result: { tag: FileTag; path: string }[] = [];
  for (const tag of tagList) {
    const currentPath = parentPath ? `${parentPath} / ${tag.name}` : tag.name;
    result.push({ tag, path: currentPath });
    if (tag.children && tag.children.length > 0) {
      result.push(...collectTagsWithPath(tag.children, currentPath));
    }
  }
  return result;
};

// 平铺视图折叠状态本地存储 key
const COLLAPSE_STATE_KEY = "tag_flat_view_collapsed";

export const TagFlatView: React.FC<TagFlatViewProps> = ({
  tags,
  tagsLoading,
  onOpenManage,
  onFileAction,
  onlyPrimary,
}) => {
  const [flatGroups, setFlatGroups] = useState<FlatGroup[]>([]);
  const [flatLoading, setFlatLoading] = useState(false);
  const [collapsedMap, setCollapsedMap] = useState<Record<number, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COLLAPSE_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<number, boolean>;
      // 只接受布尔值，防止异常数据
      return Object.keys(parsed).reduce<Record<number, boolean>>((acc, key) => {
        const v = parsed[key as any as number];
        if (typeof v === "boolean") {
          acc[Number(key)] = v;
        }
        return acc;
      }, {});
    } catch {
      return {};
    }
  });

  // 加载平铺模式数据
  const loadFlatData = useCallback(async () => {
    if (tags.length === 0) {
      setFlatGroups([]);
      return;
    }

    setFlatLoading(true);
    try {
      const tagsWithPath = collectTagsWithPath(tags);
      const groups: FlatGroup[] = [];

      for (const { tag, path } of tagsWithPath) {
        try {
          const entryIds = await getEntriesForTag(tag.id, false, onlyPrimary);

          if (entryIds.length === 0) {
            // 没有文件也要展示标签分组，只是文件列表为空
            groups.push({ tag, path, files: [] });
            continue;
          }

          // 获取文件详情
          const files = await Promise.all(
            entryIds.map(async (id) => {
              try {
                const res = await getEntry(id);
                return res.entry;
              } catch {
                return null;
              }
            })
          );

          const validFiles = files.filter((f): f is FileEntry => f !== null);
          groups.push({ tag, path, files: validFiles });
        } catch (err) {
          // 某个标签加载失败时忽略该标签，继续处理后续标签
          console.error("加载标签文件失败", tag.id, err);
          continue;
        }
      }

      setFlatGroups(groups);
    } catch (err) {
      console.error("加载平铺数据失败", err);
      setFlatGroups([]);
    } finally {
      setFlatLoading(false);
    }
  }, [tags, onlyPrimary]);

  // 当标签数据变化或首次进入时加载数据
  useEffect(() => {
    if (!tagsLoading && tags.length > 0) {
      loadFlatData();
    }
  }, [tagsLoading, tags, loadFlatData]);

  // 当标签列表变化时，清理折叠状态中已不存在的标签 id
  useEffect(() => {
    if (tags.length === 0) return;
    const allWithPath = collectTagsWithPath(tags);
    const validIds = new Set(allWithPath.map(({ tag }) => tag.id));
    setCollapsedMap((prev) => {
      const next: Record<number, boolean> = {};
      for (const key of Object.keys(prev)) {
        const id = Number(key);
        if (validIds.has(id)) {
          next[id] = prev[id];
        }
      }
      // 同步到本地存储
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, [tags]);

  // 加载或无数据状态
  if (tagsLoading || flatLoading) {
    return (
      <div className="flex items-center justify-center h-full text-foreground/70">
        加载中...
      </div>
    );
  }

  if (flatGroups.length === 0) {
    if (tags.length === 0) {
      // 既没有文件也没有标签
      return (
        <div className="flex flex-col items-center justify-center h-full text-foreground/70 gap-2">
          <Tag className="h-8 w-8 text-primary/80" />
          <p className="text-sm">暂无标签文件</p>
          <GlassButton
            glassVariant="lite"
            onClick={onOpenManage}
          >
            前往标签管理
          </GlassButton>
        </div>
      );
    }

    // 有标签但分组尚未加载到（理论上不太会发生），兜底提示
    return (
      <div className="flex flex-col items-center justify-center h-full text-foreground/70 gap-2">
        <Tag className="h-8 w-8 text-primary/80" />
        <p className="text-sm">正在加载标签文件...</p>
      </div>
    );
  }

  // 正常分组展示
  return (
    <div className="space-y-6">
      {flatGroups.map((group) => {
        const isCollapsed = collapsedMap[group.tag.id] ?? true;
        return (
          <div key={group.tag.id} className="space-y-2">
            {/* 分组标题：整行使用接近页面背景的卡片色，跟随浅色/深色主题，仅用左侧小圆点体现标签颜色 */}
            <div
              className={cn(
                "flex items-center gap-2 px-2 py-1 sticky top-0 z-10",
                DS.glass.strong,
                DS.radius.lg
              )}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                style={{
                  backgroundColor: group.tag.color || "#6b7280",
                }}
              />
              <span className="text-sm font-medium truncate text-foreground">{group.path}</span>
              <span className="text-xs text-foreground/70">({group.files.length})</span>

              <button
                type="button"
                className="ml-auto inline-flex items-center justify-center w-6 h-6 text-foreground/70 hover:text-foreground transition-colors"
                onClick={() => {
                  setCollapsedMap((prev) => {
                    const current = prev[group.tag.id] ?? true;
                    const next: Record<number, boolean> = {
                      ...prev,
                      [group.tag.id]: !current,
                    };
                    // 切换时同步保存到本地
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(COLLAPSE_STATE_KEY, JSON.stringify(next));
                    }
                    return next;
                  });
                }}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-foreground/80" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-foreground/80" />
                )}
              </button>
            </div>
            {/* 文件网格或空提示：使用轻量容器包裹，与 FileGridItem 玻璃风格协调 */}
            {!isCollapsed && (
              <div className="mt-1 rounded-xl border border-white/10 bg-background/20 px-2 py-2">
                {group.files.length === 0 ? (
                  <div className="text-xs text-foreground/70">
                    该标签下暂无文件
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {group.files.map((file) => (
                      <FileGridItem
                        key={`${group.tag.id}-${file.id}`}
                        entry={file}
                        onClick={() => onFileAction("click", file)}
                        onAction={onFileAction}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
