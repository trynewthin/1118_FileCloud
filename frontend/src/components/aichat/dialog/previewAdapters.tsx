import { ImageUrlPreview, VideoUrlPreview, AudioUrlPreview, PdfUrlPreview, TextUrlPreview } from "./UrlPreviews";
import type { PreviewDialogAdapter } from "./PreviewDialog";

type UrlPreviewKind = "markdown" | "text" | "image" | "video" | "audio" | "pdf" | "unknown";

function inferUrlPreviewKind(options: {
  originalName?: string | null;
  mimeType?: string | null;
}): UrlPreviewKind {
  const mime = (options.mimeType || "").toLowerCase();
  const name = (options.originalName || "").toLowerCase();
  const ext = name.includes(".") ? name.substring(name.lastIndexOf(".")) : "";

  if (mime === "application/pdf" || ext === ".pdf") return "pdf";
  if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif", ".ico"].includes(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || [".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v", ".wmv"].includes(ext)) {
    return "video";
  }
  if (mime.startsWith("audio/") || [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".opus"].includes(ext)) {
    return "audio";
  }
  if (mime === "text/markdown" || ext === ".md" || ext === ".markdown") return "markdown";
  if (mime.startsWith("text/") || [".txt", ".json", ".xml", ".yaml", ".yml", ".log", ".ini", ".conf", ".cfg", ".env"].includes(ext)) {
    return "text";
  }
  return "unknown";
}

export function createUrlPreviewAdapter(options: {
  title?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  contentUrl: string | null;
  downloadUrl?: string | null;
  forcedKind?: UrlPreviewKind;
}): PreviewDialogAdapter {
  const kind = options.forcedKind ?? inferUrlPreviewKind({
    originalName: options.originalName ?? options.title,
    mimeType: options.mimeType ?? null,
  });

  const title = options.title ?? options.originalName ?? "预览";

  return {
    title,
    downloadUrl: options.downloadUrl ?? null,
    render: ({ open }) => {
      if (kind === "image") {
        return <ImageUrlPreview key={options.contentUrl} contentUrl={options.contentUrl} title={title} />;
      }
      if (kind === "video") {
        return <VideoUrlPreview contentUrl={options.contentUrl} />;
      }
      if (kind === "audio") {
        return <AudioUrlPreview contentUrl={options.contentUrl} />;
      }
      if (kind === "pdf") {
        return <PdfUrlPreview contentUrl={options.contentUrl} title={title} />;
      }
      if (kind === "markdown") {
        return <TextUrlPreview key={`${open}:${options.contentUrl}`} open={open} contentUrl={options.contentUrl} renderAsMarkdown={true} />;
      }
      if (kind === "text") {
        return <TextUrlPreview key={`${open}:${options.contentUrl}`} open={open} contentUrl={options.contentUrl} renderAsMarkdown={false} />;
      }
      return <div className="text-sm text-muted-foreground py-10 text-center">暂不支持预览该文件类型</div>;
    },
  };
}

export function createMarkdownPreviewAdapter(options: {
  title?: string | null;
  contentUrl: string | null;
  downloadUrl?: string | null;
}): PreviewDialogAdapter {
  return createUrlPreviewAdapter({
    title: options.title ?? "Markdown 预览",
    originalName: options.title ?? "Markdown 预览",
    mimeType: "text/markdown",
    contentUrl: options.contentUrl,
    downloadUrl: options.downloadUrl ?? null,
    forcedKind: "markdown",
  });
}

