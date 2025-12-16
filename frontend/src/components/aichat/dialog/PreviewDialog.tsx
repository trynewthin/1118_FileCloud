import type React from "react";
import { useEffect, useState } from "react";
import { Download, XIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/common/dialog/dialog";
import { DS } from "@/theme/design-system";
import { cn } from "@/lib/utils";

export interface PreviewDialogAdapter {
  title?: string | null;
  downloadUrl?: string | null;
  render: (options: { open: boolean }) => React.ReactNode;
}

export interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adapter: PreviewDialogAdapter;
}

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

function ImageUrlPreview({ contentUrl, title }: { contentUrl: string | null; title?: string | null }) {
  const [error, setError] = useState(false);

  if (!contentUrl) {
    return <div className="text-sm text-muted-foreground py-10 text-center">无法获取预览地址</div>;
  }

  if (error) {
    return <div className="text-sm text-muted-foreground py-10 text-center">图片加载失败</div>;
  }

  return (
    <div className="w-full flex items-center justify-center">
      <img
        src={contentUrl}
        alt={title || "图片"}
        className="max-w-full max-h-[70vh] object-contain rounded-xl"
        onError={() => setError(true)}
        draggable={false}
      />
    </div>
  );
}

function VideoUrlPreview({ contentUrl }: { contentUrl: string | null }) {
  if (!contentUrl) {
    return <div className="text-sm text-muted-foreground py-10 text-center">无法获取预览地址</div>;
  }

  return (
    <div className="w-full">
      <video
        src={contentUrl}
        controls
        className="w-full max-h-[70vh] rounded-xl bg-black/20"
      />
    </div>
  );
}

function AudioUrlPreview({ contentUrl }: { contentUrl: string | null }) {
  if (!contentUrl) {
    return <div className="text-sm text-muted-foreground py-10 text-center">无法获取预览地址</div>;
  }

  return (
    <div className="w-full">
      <audio src={contentUrl} controls className="w-full" />
    </div>
  );
}

function PdfUrlPreview({ contentUrl, title }: { contentUrl: string | null; title?: string | null }) {
  if (!contentUrl) {
    return <div className="text-sm text-muted-foreground py-10 text-center">无法获取预览地址</div>;
  }

  return (
    <div className="w-full h-[70vh] min-h-[420px]">
      <iframe src={contentUrl} className="w-full h-full border-0" title={title || "PDF"} />
    </div>
  );
}

function TextUrlPreview({
  open,
  contentUrl,
  renderAsMarkdown,
}: {
  open: boolean;
  contentUrl: string | null;
  renderAsMarkdown: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setContent(null);
      setError(null);
      return;
    }

    if (!contentUrl) {
      setError("无法获取预览地址");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(contentUrl);
        if (!res.ok) {
          throw new Error(`加载失败(${res.status})`);
        }
        const text = await res.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(typeof e?.message === "string" ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, contentUrl]);

  if (loading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">加载中...</div>;
  }

  if (error) {
    return <div className="text-sm text-muted-foreground py-10 text-center">{error}</div>;
  }

  if (!content) {
    return <div className="text-sm text-muted-foreground py-10 text-center">暂无内容</div>;
  }

  if (!renderAsMarkdown) {
    return (
      <pre className="p-4 text-sm font-mono whitespace-pre-wrap wrap-break-word overflow-x-auto max-h-[70vh] overflow-y-auto bg-muted/20 rounded-xl">
        {content}
      </pre>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5",
        "prose-pre:my-2 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/70 dark:prose-pre:bg-black/50 prose-pre:px-3 prose-pre:py-2.5 prose-pre:shadow-inner",
        "prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
        "prose-code:before:content-none prose-code:after:content-none",
        "[&_pre_code]:bg-transparent [&_pre_code]:text-slate-50 dark:[&_pre_code]:text-slate-100 [&_pre_code]:p-0",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
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
        return <ImageUrlPreview contentUrl={options.contentUrl} title={title} />;
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
        return <TextUrlPreview open={open} contentUrl={options.contentUrl} renderAsMarkdown={true} />;
      }
      if (kind === "text") {
        return <TextUrlPreview open={open} contentUrl={options.contentUrl} renderAsMarkdown={false} />;
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

export function PreviewDialog({ open, onOpenChange, adapter }: PreviewDialogProps) {
  const title = adapter.title;
  const downloadUrl = adapter.downloadUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("p-0! gap-0! sm:max-w-[880px]", cn(DS.radius.xl, "button-rect:rounded-lg"))} showCloseButton={false}>
        <div className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle className="text-base">{title || "预览"}</DialogTitle>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {adapter.render({ open })}
        </div>

        <div className="px-5 pb-4">
          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => onOpenChange(false)}
            leftButtonGlassVariant="lite"
            rightButtonIcon={downloadUrl ? <Download className="h-4 w-4" /> : undefined}
            onRightButtonClick={
              downloadUrl
                ? () => {
                    window.open(downloadUrl, "_blank");
                  }
                : undefined
            }
            rightButtonGlassVariant="lite"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
