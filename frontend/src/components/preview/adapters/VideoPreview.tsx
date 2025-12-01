import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { VideoPlayer } from "@/components/preview/VideoPlayer";

interface VideoPreviewProps {
  entry: FileEntry;
}

// 文件视频预览：负责构造流式播放地址并交给通用播放器渲染
export function VideoPreview({ entry }: VideoPreviewProps) {
  const token = getAuthToken();

  const streamPath = token
    ? `/file-content/${entry.id}/stream?token=${encodeURIComponent(token)}`
    : `/file-content/${entry.id}/stream`;
  const url = buildApiUrl(streamPath);

  const thumbnailPath = token
    ? `/file-content/${entry.id}/thumbnail?token=${encodeURIComponent(token)}`
    : `/file-content/${entry.id}/thumbnail`;
  const thumbnailUrl = buildApiUrl(thumbnailPath);

  return <VideoPlayer src={url} title={entry.original_name} poster={thumbnailUrl} />;
}
