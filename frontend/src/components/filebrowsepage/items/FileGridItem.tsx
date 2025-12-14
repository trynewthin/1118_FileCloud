import type { FileEntry } from "@/lib/api/files";
import { SkeuoFileItem } from "@/components/filebrowsepage/items/SkeuoFileItem";
import { SkeuoFolderItem } from "@/components/filebrowsepage/items/SkeuoFolderItem";

interface FileGridItemProps {
  entry: FileEntry;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onAction?: (action: string, entry: FileEntry) => void;
  // 批量模式相关
  batchMode?: boolean;
  batchSelected?: boolean;
  onBatchSelect?: (entry: FileEntry, selected: boolean) => void;
  // 融合访问：库离线状态
  libraryOffline?: boolean;
  // 文件库操作回调（仅当 entry._isLibraryEntry 为 true 时使用）
  onLibraryAction?: (action: "config" | "delete" | "reindex", libraryId: number) => void;
}

export function FileGridItem({
  entry,
  selected,
  onClick,
  onDoubleClick,
  onAction,
  batchMode = false,
  batchSelected = false,
  onBatchSelect,
  libraryOffline = false,
  onLibraryAction,
}: FileGridItemProps) {
  const isDir = entry.is_directory;
  const isLibrary = entry._isLibraryEntry === true;
  const isVirtualTags = entry._virtualType === "tags";

  if (isDir || isLibrary || isVirtualTags) {
    return (
      <SkeuoFolderItem
        entry={entry}
        selected={selected}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onAction={onAction}
        batchMode={batchMode}
        batchSelected={batchSelected}
        onBatchSelect={onBatchSelect}
        libraryOffline={libraryOffline}
        onLibraryAction={onLibraryAction}
      />
    );
  }

  return (
    <SkeuoFileItem
      entry={entry}
      selected={selected}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onAction={onAction}
      batchMode={batchMode}
      batchSelected={batchSelected}
      onBatchSelect={onBatchSelect}
      libraryOffline={libraryOffline}
      ext={entry.extension ?? ""}
      subtitle={formatSize(entry.size_bytes)}
    />
  );
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
