import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { getEntry, type FileEntry } from "@/lib/api/files";
import { VideoPreview } from "@/components/preview/adapters/VideoPreview";
import { DefaultPreview } from "@/components/preview/adapters/DefaultPreview";
import { GlassCard } from "@/components/common/GlassCard";

export function FilePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<FileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <PageContainer title="文件预览" showBack>
      <div className="flex-1 flex flex-col min-h-0 h-full">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            加载中...
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <GlassCard variant="strong" className="flex-1 relative flex flex-col p-0">
             {renderPreviewer()}
          </GlassCard>
        )}
      </div>
    </PageContainer>
  );
}
