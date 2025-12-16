import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { Copy, Move, Trash2, Download, Tag } from "lucide-react";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { getEntry, type FileEntry } from "@/lib/api/files";
import { VideoPreview } from "@/components/preview/adapters/VideoPreview";
import { AudioPreview } from "@/components/preview/adapters/AudioPreview";
import { ImagePreview } from "@/components/preview/adapters/ImagePreview";
import { TextPreview } from "@/components/preview/adapters/TextPreview";
import { PdfPreview } from "@/components/preview/adapters/PdfPreview";
import { DefaultPreview } from "@/components/preview/adapters/DefaultPreview";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { GlassButtonGroup } from "@/components/common/button/GlassButtonGroup";
import { DeleteDialog, MoveCopyDialog } from "@/components/filebrowsepage";
import { EntryTagDialog, TagInfoCard } from "@/components/tag";
import { useFileBrowser } from "@/hooks/useFileBrowser";

export function FilePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 操作对话框状态
  const [actionDialog, setActionDialog] = useState<{
    type: "delete" | "move" | "copy" | null;
  }>({ type: null });

  // 标签对话框状态
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  // 标签刷新标识
  const [tagRefreshKey, setTagRefreshKey] = useState(0);

  // 使用 useFileBrowser 获取操作方法
  const { remove, move, copy } = useFileBrowser({ 
    libraryId: entry?.library_id ?? null 
  });

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        // TODO: 这里如果文件加密，getEntry 可能需要密码
        // 目前假设已解锁或无需密码，或者后续完善密码输入 UI
        const res = await getEntry(id);
        setEntry(res.entry);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "加载文件详情失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // 处理删除
  const handleDeleteSubmit = async (entryToDelete: FileEntry) => {
    await remove(entryToDelete.id);
    // 删除成功后返回文件浏览页
    navigate(`/files?libraryId=${entryToDelete.library_id}${entryToDelete.parent_id ? `&parentId=${entryToDelete.parent_id}` : ''}`);
  };

  // 处理移动/复制
  const handleMoveCopySubmit = async (
    entryToMove: FileEntry,
    targetParentId: string | null,
    newName?: string
  ) => {
    if (actionDialog.type === "move") {
      await move(entryToMove.id, { targetParentId });
      // 移动成功后返回目标目录
      navigate(`/files?libraryId=${entryToMove.library_id}${targetParentId ? `&parentId=${targetParentId}` : ''}`);
    } else if (actionDialog.type === "copy") {
      await copy(entryToMove.id, { targetParentId, newName });
      // 复制成功后可以留在当前页面，或者跳转到目标目录
    }
  };

  const renderPreviewer = () => {
    if (!entry) return null;

    const mime = entry.mime_type || "";
    const nameLower = entry.original_name.toLowerCase();
    const ext = nameLower.substring(nameLower.lastIndexOf("."));

    // 视频文件
    const videoExts = [".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v", ".wmv"];
    if (mime.startsWith("video/") || videoExts.includes(ext)) {
      return <VideoPreview entry={entry} />;
    }

    // 音频文件
    const audioExts = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"];
    if (mime.startsWith("audio/") || audioExts.includes(ext)) {
      return <AudioPreview entry={entry} />;
    }

    // 图片文件
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".tiff", ".tif", ".heic", ".heif", ".avif"];
    if (mime.startsWith("image/") || imageExts.includes(ext)) {
      return <ImagePreview entry={entry} />;
    }

    // PDF 文件
    if (mime === "application/pdf" || ext === ".pdf") {
      return <PdfPreview entry={entry} />;
    }

    // 文本文件
    const textExts = [
      ".txt", ".md", ".markdown", ".json", ".xml", ".yaml", ".yml",
      ".log", ".ini", ".conf", ".cfg", ".env",
      ".js", ".ts", ".jsx", ".tsx", ".vue", ".svelte",
      ".css", ".scss", ".less", ".sass",
      ".html", ".htm", ".svg",
      ".py", ".rb", ".php", ".java", ".c", ".cpp", ".h", ".hpp",
      ".go", ".rs", ".swift", ".kt", ".scala",
      ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd",
      ".sql", ".graphql", ".prisma",
      ".toml", ".csv", ".tsv",
    ];
    const textMimePatterns = ["text/", "application/json", "application/xml", "application/javascript"];
    const isTextByMime = textMimePatterns.some(p => mime.startsWith(p));
    if (isTextByMime || textExts.includes(ext)) {
      return <TextPreview entry={entry} />;
    }

    return <DefaultPreview entry={entry} />;
  };

  const pageTitle = entry ? entry.original_name : "文件预览";

  const handleBack = () => {
    if (entry) {
      navigate(`/files?libraryId=${entry.library_id}${entry.parent_id ? `&parentId=${entry.parent_id}` : ""}`);
    } else {
      navigate(-1);
    }
  };

  // 下载文件
  const handleDownload = () => {
    if (!entry) return;
    const token = getAuthToken();
    const downloadUrl = buildApiUrl(
      `/files/entries/${entry.id}/download/${encodeURIComponent(entry.original_name)}${token ? `?token=${encodeURIComponent(token)}` : ""}`
    );
    window.open(downloadUrl, "_blank");
  };

  const leftActionButtons = entry ? (
    <GlassIconButton glassVariant="lite" onClick={() => setTagDialogOpen(true)} title="标签">
      <Tag className="h-4 w-4" />
    </GlassIconButton>
  ) : null;

  const rightActionButtons = entry ? (
    <GlassButtonGroup glassVariant="lite">
      <GlassIconButton glassVariant="lite" onClick={handleDownload} title="下载">
        <Download className="h-4 w-4" />
      </GlassIconButton>

      <GlassIconButton glassVariant="lite" onClick={() => setActionDialog({ type: "copy" })} title="复制">
        <Copy className="h-4 w-4" />
      </GlassIconButton>

      <GlassIconButton glassVariant="lite" onClick={() => setActionDialog({ type: "move" })} title="移动">
        <Move className="h-4 w-4" />
      </GlassIconButton>

      <GlassIconButton
        glassVariant="lite"
        onClick={() => setActionDialog({ type: "delete" })}
        title="删除"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </GlassIconButton>
    </GlassButtonGroup>
  ) : null;

  return (
    <PageContainer
      title={pageTitle}
      showBack
      leftAction={leftActionButtons}
      action={rightActionButtons}
      onBack={handleBack}
      headerOverlay
      headerOverlayMaskClassName="h-[calc(132px+env(safe-area-inset-top))]"
      scroll
      scrollFullBleed
      scrollPaddingClassName="pt-[calc(132px+env(safe-area-inset-top)+10px)] pb-4"
    >
      {loading ? (
        <div className="flex h-full items-center justify-center" />
      ) : error ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          加载失败
        </div>
      ) : (
        entry && (
          <div className="flex flex-col gap-3 max-w-5xl w-full mx-auto">
            <div className="relative flex flex-col p-0 w-full">
              {renderPreviewer()}
            </div>
            <TagInfoCard entryId={entry.id} refreshKey={tagRefreshKey} />
          </div>
        )
      )}

      {/* 移动/复制对话框 */}
      {(actionDialog.type === "move" || actionDialog.type === "copy") && entry && (
        <MoveCopyDialog
          mode={actionDialog.type}
          entry={entry}
          open={true}
          onOpenChange={(open) => !open && setActionDialog({ type: null })}
          onSubmit={handleMoveCopySubmit}
        />
      )}

      {/* 删除对话框 */}
      {actionDialog.type === "delete" && entry && (
        <DeleteDialog
          entry={entry}
          open={true}
          onOpenChange={(open) => !open && setActionDialog({ type: null })}
          onSubmit={handleDeleteSubmit}
        />
      )}

      {/* 标签对话框 */}
      {tagDialogOpen && entry && (
        <EntryTagDialog
          open={true}
          onOpenChange={(open) => {
            setTagDialogOpen(open);
            // 对话框关闭时刷新标签卡片
            if (!open) {
              setTagRefreshKey((k) => k + 1);
            }
          }}
          entryId={entry.id}
        />
      )}
    </PageContainer>
  );
}
