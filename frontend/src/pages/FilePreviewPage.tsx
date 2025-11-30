import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Copy, Move, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { getEntry, type FileEntry } from "@/lib/api/files";
import { VideoPreview } from "@/components/preview/adapters/VideoPreview";
import { DefaultPreview } from "@/components/preview/adapters/DefaultPreview";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";
import { DeleteDialog } from "@/components/files/dialogs/DeleteDialog";
import { MoveCopyDialog } from "@/components/files/dialogs/MoveCopyDialog";
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

  // 使用 useFileBrowser 获取操作方法
  const { remove, move, copy } = useFileBrowser({ 
    libraryId: entry?.library_id ?? null 
  });

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

    const isVideoByMime = mime.startsWith("video/");
    const isVideoByExt = [".mp4", ".webm", ".mkv", ".mov", ".avi"].some((ext) =>
      nameLower.endsWith(ext),
    );

    if (isVideoByMime || isVideoByExt) {
      return <VideoPreview entry={entry} />;
    }

    // 后续可以加 ImagePreview, AudioPreview, PdfPreview 等

    return <DefaultPreview entry={entry} />;
  };

  const pageTitle = entry ? entry.original_name : "文件预览";

  // 操作按钮
  const actionButtons = entry ? (
    <div className="flex items-center gap-2">
      <GlassButton
        glassVariant="ghost"
        size="icon"
        onClick={() => setActionDialog({ type: "copy" })}
        title="复制"
      >
        <Copy className="h-4 w-4" />
      </GlassButton>
      <GlassButton
        glassVariant="ghost"
        size="icon"
        onClick={() => setActionDialog({ type: "move" })}
        title="移动"
      >
        <Move className="h-4 w-4" />
      </GlassButton>
      <GlassButton
        glassVariant="ghost"
        size="icon"
        onClick={() => setActionDialog({ type: "delete" })}
        title="删除"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </GlassButton>
    </div>
  ) : null;

  return (
    <PageContainer title={pageTitle} showBack action={actionButtons}>
      <div className="flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            加载中...
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <GlassCard
            variant="strong"
            className="relative flex flex-col p-0 max-w-5xl w-full mx-auto"
          >
            {renderPreviewer()}
          </GlassCard>
        )}
      </div>

      {/* 删除对话框 */}
      {actionDialog.type === "delete" && entry && (
        <DeleteDialog
          entry={entry}
          open={true}
          onOpenChange={(open) => !open && setActionDialog({ type: null })}
          onSubmit={handleDeleteSubmit}
        />
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
    </PageContainer>
  );
}
