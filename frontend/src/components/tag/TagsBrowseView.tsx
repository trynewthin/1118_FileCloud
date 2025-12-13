import { useEffect, useMemo, useState } from "react";
import { Tag as TagIcon } from "lucide-react";
import { FileGridItem, FileListItem } from "@/components/filebrowsepage";
import { TagGridItem, TagFlatView } from "@/components/tag";
import { useTagList } from "@/hooks/useTags";
import { getEntriesForTag } from "@/lib/api/tags";
import { downloadEntry, getEntry } from "@/lib/api/files";
import type { FileEntry } from "@/lib/api/files";
import type { FileTag } from "@/lib/api/tags";

const flattenTags = (tags: FileTag[]): FileTag[] => {
  return tags.reduce<FileTag[]>((acc, tag) => {
    acc.push(tag);
    if (tag.children && tag.children.length > 0) {
      acc.push(...flattenTags(tag.children));
    }
    return acc;
  }, []);
};

interface TagsBrowseViewProps {
  onOpenEntry: (entryId: string) => void;
  onOpenEntryTagDialog: (entry: FileEntry) => void;
  onOpenRename: (entry: FileEntry) => void;
  onOpenMove: (entry: FileEntry) => void;
  onOpenCopy: (entry: FileEntry) => void;
  onOpenDelete: (entry: FileEntry) => void;
  viewMode: "grid" | "list";
  tagViewMode: "folder" | "flat";
  onlyPrimary: boolean;
}

export const TagsBrowseView = ({
  onOpenEntry,
  onOpenEntryTagDialog,
  onOpenRename,
  onOpenMove,
  onOpenCopy,
  onOpenDelete,
  viewMode,
  tagViewMode,
  onlyPrimary,
}: TagsBrowseViewProps) => {
  const { tags, loading } = useTagList();

  const [currentTagId, setCurrentTagId] = useState<number | null>(null);

  const [tagFiles, setTagFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const allFlatTags = useMemo(() => flattenTags(tags), [tags]);
  const currentTag = currentTagId ? allFlatTags.find((t) => t.id === currentTagId) : null;

  const currentLevelTags = useMemo(() => {
    if (!currentTagId) return tags;
    return currentTag?.children || [];
  }, [tags, currentTagId, currentTag]);

  useEffect(() => {
    setTagFiles([]);
    if (!currentTagId) return;

    let cancelled = false;
    const loadFiles = async () => {
      setFilesLoading(true);
      try {
        const entryIds = await getEntriesForTag(currentTagId, false, onlyPrimary);
        if (cancelled) return;

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
      } catch {
        if (!cancelled) setTagFiles([]);
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    };

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [currentTagId, onlyPrimary]);

  const handleFileAction = (action: string, entry: FileEntry) => {
    switch (action) {
      case "click":
        onOpenEntry(entry.id);
        break;
      case "download":
        window.open(downloadEntry(entry.id), "_blank");
        break;
      case "rename":
        onOpenRename(entry);
        break;
      case "move":
        onOpenMove(entry);
        break;
      case "copy":
        onOpenCopy(entry);
        break;
      case "delete":
        onOpenDelete(entry);
        break;
      case "tag":
        onOpenEntryTagDialog(entry);
        break;
    }
  };

  return (
    <div className="h-full">
      {tagViewMode === "flat" ? (
        <TagFlatView
          tags={tags}
          tagsLoading={loading}
          onOpenManage={() => {}}
          onFileAction={handleFileAction}
          onlyPrimary={onlyPrimary}
        />
      ) : (
        loading || filesLoading ? (
          <div className="flex items-center justify-center h-full" />
        ) : !currentTagId ? (
          currentLevelTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <TagIcon className="h-8 w-8" />
              <p>暂无标签</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {currentLevelTags.map((tag) => (
                <TagGridItem key={tag.id} tag={tag} onClick={() => setCurrentTagId(tag.id)} />
              ))}
            </div>
          )
        ) : (
          currentLevelTags.length === 0 && tagFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <TagIcon className="h-8 w-8" />
              <p>该标签下暂无内容</p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" : "space-y-2"}>
              {currentLevelTags.map((tag) => (
                <TagGridItem key={`tag-${tag.id}`} tag={tag} onClick={() => setCurrentTagId(tag.id)} />
              ))}
              {tagFiles.map((file) => {
                const Component = viewMode === "grid" ? FileGridItem : FileListItem;
                return (
                  <Component
                    key={`file-${file.id}`}
                    entry={file}
                    onClick={() => handleFileAction("click", file)}
                    onAction={handleFileAction}
                  />
                );
              })}
            </div>
          )
        )
      )}
    </div>
  );
};
