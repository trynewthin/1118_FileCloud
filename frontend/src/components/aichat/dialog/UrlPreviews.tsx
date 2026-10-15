import { getErrorMessage } from "@/lib/api/errors";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function ImageUrlPreview({ contentUrl, title }: { contentUrl: string | null; title?: string | null }) {
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

export function VideoUrlPreview({ contentUrl }: { contentUrl: string | null }) {
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

export function AudioUrlPreview({ contentUrl }: { contentUrl: string | null }) {
  if (!contentUrl) {
    return <div className="text-sm text-muted-foreground py-10 text-center">无法获取预览地址</div>;
  }

  return (
    <div className="w-full">
      <audio src={contentUrl} controls className="w-full" />
    </div>
  );
}

export function PdfUrlPreview({ contentUrl, title }: { contentUrl: string | null; title?: string | null }) {
  if (!contentUrl) {
    return <div className="text-sm text-muted-foreground py-10 text-center">无法获取预览地址</div>;
  }

  return (
    <div className="w-full h-[70vh] min-h-[420px]">
      <iframe src={contentUrl} className="w-full h-full border-0" title={title || "PDF"} />
    </div>
  );
}

export function TextUrlPreview({
  open,
  contentUrl,
  renderAsMarkdown,
}: {
  open: boolean;
  contentUrl: string | null;
  renderAsMarkdown: boolean;
}) {
  const [result, setResult] = useState<{ content: string | null; error: string | null } | null>(null);
  const loading = open && Boolean(contentUrl) && result === null;
  const content = result?.content ?? null;
  const error = !contentUrl ? "无法获取预览地址" : result?.error;

  useEffect(() => {
    if (!open || !contentUrl) return;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(contentUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`加载失败(${res.status})`);
        const text = await res.text();
        if (!controller.signal.aborted) setResult({ content: text, error: null });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setResult({ content: null, error: getErrorMessage(error, "加载失败") });
        }
      }
    };
    void load();
    return () => controller.abort();
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

