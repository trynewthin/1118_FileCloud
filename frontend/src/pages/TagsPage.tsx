import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, ChevronRight, Home, Settings } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import { FileGridItem } from "@/components/files/FileGridItem";
import { useTagList } from "@/hooks/useTags";
import { TagManageDialog, TagGridItem } from "@/components/tag";
import { getEntriesForTag } from "@/lib/api/tags";
import { getEntry, downloadEntry } from "@/lib/api/files";
import { RenameDialog } from "@/components/files/dialogs/RenameDialog";
import { DeleteDialog } from "@/components/files/dialogs/DeleteDialog";
import { MoveCopyDialog } from "@/components/files/dialogs/MoveCopyDialog";
import { EntryTagDialog } from "@/components/tag";
import type { FileTag } from "@/lib/api/tags";
import type { FileEntry } from "@/lib/api/files";

// 扁平化标签树，用于查找父标签
const flattenTags = (tags: FileTag[]): FileTag[] => {
  return tags.reduce<FileTag[]>((acc, tag) => {
    acc.push(tag);
    if (tag.children && tag.children.length > 0) {
      acc.push(...flattenTags(tag.children));
    }
    return acc;
  }, []);
};

export const TagsPage = () => {
  const navigate = useNavigate();
  const { tags, loading, reload: reloadTags } = useTagList();

  // 当前选中的标签 ID（null 表示根级）
  const [currentTagId, setCurrentTagId] = useState<number | null>(null);

  // 标签管理对话框
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  // 文件操作对话框状态
  const [actionDialog, setActionDialog] = useState<{
    type: "rename" | "delete" | "move" | "copy" | null;
    entry?: FileEntry;
  }>({ type: null });
  const [tagDialogEntry, setTagDialogEntry] = useState<FileEntry | null>(null);

  // 当前标签下的文件列表
  const [tagFiles, setTagFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // 所有标签的扁平列表
  const allFlatTags = useMemo(() => flattenTags(tags), [tags]);

  // 当前标签对象
  const currentTag = currentTagId ? allFlatTags.find((t) => t.id === currentTagId) : null;

  // 当前层级的标签列表
  const currentLevelTags = useMemo(() => {
    if (!currentTagId) {
      // 根级：显示所有一级标签
      return tags;
    }
    // 显示当前标签的子标签
    return currentTag?.children || [];
  }, [tags, currentTagId, currentTag]);

  // 面包屑路径
  const breadcrumbPath = useMemo(() => {
    if (!currentTagId) return [];
    const path: FileTag[] = [];
    let tag = currentTag;
    while (tag) {
      path.unshift(tag);
      tag = tag.parent_tag_id ? allFlatTags.find((t) => t.id === tag!.parent_tag_id) : null;
    }
    return path;
  }, [currentTagId, currentTag, allFlatTags]);

  // 加载当前标签下的文件
  useEffect(() => {
    // 切换标签时先清空旧数据
    setTagFiles([]);
    
    if (!currentTagId) {
      return;
    }

    let cancelled = false;

    const loadFiles = async () => {
      setFilesLoading(true);
      try {
        // 只获取当前标签直接关联的文件，不包含子标签
        const entryIds = await getEntriesForTag(currentTagId, false);
        if (cancelled) return;
        
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
        if (cancelled) return;
        
        setTagFiles(files.filter((f): f is FileEntry => f !== null));
      } catch (err) {
        console.error("加载标签文件失败", err);
        if (!cancelled) {
          setTagFiles([]);
        }
      } finally {
        if (!cancelled) {
          setFilesLoading(false);
        }
      }
    };

    loadFiles();
    
    return () => {
      cancelled = true;
    };
  }, [currentTagId]);

  // 点击标签：进入该标签
  const handleTagClick = (tag: FileTag) => {
    setCurrentTagId(tag.id);
  };

  // 文件操作处理
  const handleFileAction = (action: string, entry: FileEntry) => {
    switch (action) {
      case "click":
        navigate(`/preview/${entry.id}`);
        break;
      case "download":
        window.open(downloadEntry(entry.id), "_blank");
        break;
      case "rename":
        setActionDialog({ type: "rename", entry });
        break;
      case "move":
        setActionDialog({ type: "move", entry });
        break;
      case "copy":
        setActionDialog({ type: "copy", entry });
        break;
      case "delete":
        setActionDialog({ type: "delete", entry });
        break;
      case "tag":
        setTagDialogEntry(entry);
        break;
    }
  };

  // 操作完成后刷新文件列表
  const reloadFiles = async () => {
    if (!currentTagId) return;
    setFilesLoading(true);
    try {
      // 只获取当前标签直接关联的文件
      const entryIds = await getEntriesForTag(currentTagId, false);
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
      setTagFiles(files.filter((f): f is FileEntry => f !== null));
    } catch {
      setTagFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  // 返回根级
  const handleGoRoot = () => {
    setCurrentTagId(null);
  };

  // 点击面包屑
  const handleBreadcrumbClick = (tag: FileTag | null) => {
    setCurrentTagId(tag?.id ?? null);
  };

  return (
    <PageContainer title="标签浏览">
      {/* 面包屑导航 */}
      <GlassCard className="px-3 py-2 flex items-center gap-1 text-sm">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          <button
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 transition-colors shrink-0"
            onClick={handleGoRoot}
          >
            <Home className="h-4 w-4" />
          </button>
          {breadcrumbPath.map((tag) => (
            <div key={tag.id} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50 transition-colors"
                onClick={() => handleBreadcrumbClick(tag)}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color || "#6b7280" }}
                />
                <span>{tag.name}</span>
              </button>
            </div>
          ))}
        </div>
        {/* 设置按钮 */}
        <GlassButton
          glassVariant="ghost"
          size="icon"
          onClick={() => setManageDialogOpen(true)}
          title="标签管理"
          className="shrink-0 ml-2"
        >
          <Settings className="h-4 w-4" />
        </GlassButton>
      </GlassCard>

      {/* 内容区域 */}
      <GlassCard variant="ghost" className="flex-1 mt-4 min-h-0 overflow-y-auto px-2 py-2">
        {loading || filesLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : !currentTagId ? (
          // 根级：显示标签列表
          currentLevelTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Tag className="h-8 w-8" />
              <p>暂无标签</p>
              <GlassButton
                glassVariant="lite"
                onClick={() => setManageDialogOpen(true)}
              >
                前往标签管理
              </GlassButton>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {currentLevelTags.map((tag) => (
                <TagGridItem
                  key={tag.id}
                  tag={tag}
                  onClick={() => handleTagClick(tag)}
                />
              ))}
            </div>
          )
        ) : (
          // 已选中标签：子标签和文件混合显示
          currentLevelTags.length === 0 && tagFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Tag className="h-8 w-8" />
              <p>该标签下暂无内容</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {/* 子标签在前 */}
              {currentLevelTags.map((tag) => (
                <TagGridItem
                  key={`tag-${tag.id}`}
                  tag={tag}
                  onClick={() => handleTagClick(tag)}
                />
              ))}
              {/* 文件在后 */}
              {tagFiles.map((file) => (
                <FileGridItem
                  key={`file-${file.id}`}
                  entry={file}
                  onClick={() => handleFileAction("click", file)}
                  onAction={handleFileAction}
                />
              ))}
            </div>
          )
        )}
      </GlassCard>

      {/* 标签管理对话框 */}
      <TagManageDialog
        open={manageDialogOpen}
        onOpenChange={(open) => {
          setManageDialogOpen(open);
          // 关闭时刷新标签列表
          if (!open) {
            reloadTags();
          }
        }}
      />

      {/* 文件操作对话框 */}
      <RenameDialog
        open={actionDialog.type === "rename"}
        onOpenChange={(open) => !open && setActionDialog({ type: null })}
        entry={actionDialog.entry ?? null}
        onSubmit={reloadFiles}
      />

      <DeleteDialog
        open={actionDialog.type === "delete"}
        onOpenChange={(open) => !open && setActionDialog({ type: null })}
        entry={actionDialog.entry ?? null}
        onSubmit={async () => { await reloadFiles(); }}
      />

      <MoveCopyDialog
        open={actionDialog.type === "move" || actionDialog.type === "copy"}
        onOpenChange={(open) => !open && setActionDialog({ type: null })}
        entry={actionDialog.entry ?? null}
        mode={(actionDialog.type as "move" | "copy") || "move"}
        onSubmit={async () => { await reloadFiles(); }}
      />

      {/* 标签对话框 */}
      {tagDialogEntry && (
        <EntryTagDialog
          open={true}
          onOpenChange={(open) => !open && setTagDialogEntry(null)}
          entryId={tagDialogEntry.id}
        />
      )}
    </PageContainer>
  );
};

export default TagsPage;
