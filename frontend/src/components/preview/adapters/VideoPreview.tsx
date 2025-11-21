import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { VideoPlayer } from "@/components/preview/VideoPlayer";

interface VideoPreviewProps {
  entry: FileEntry;
}

// 文件视频预览：负责构造下载地址并交给通用播放器渲染
export function VideoPreview({ entry }: VideoPreviewProps) {
  const token = getAuthToken();
  const url =
    buildApiUrl(
      `/files/entries/${entry.id}/download/${encodeURIComponent(entry.original_name)}`,
    ) + `?token=${token || ""}`;

  const thumbnailUrl = buildApiUrl(
    token
      ? `/file-content/${entry.id}/thumbnail?token=${encodeURIComponent(token)}`
      : `/file-content/${entry.id}/thumbnail`,
  );

  return <VideoPlayer src={url} title={entry.original_name} poster={thumbnailUrl} />;
}
