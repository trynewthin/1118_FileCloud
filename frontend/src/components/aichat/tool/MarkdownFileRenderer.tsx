import { useState } from "react";
import { Download, Eye, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import {
  PreviewDialog,
  createUrlPreviewAdapter,
} from "@/components/aichat/dialog/PreviewDialog";
import type { ToolCallResult } from "./types";
import { formatSize } from "./format";

export function MarkdownFileRenderer({ result }: { result: ToolCallResult }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("filecloud_auth_token")
    : null;

  const getBaseUrlWithoutApi = () => {
    if (typeof window !== "undefined" && window.location) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:3001`;
    }
    return "http://localhost:3001";
  };

  const baseUrl = getBaseUrlWithoutApi();
  const contentUrl = result.contentUrl
    ? `${baseUrl}${result.contentUrl}${token ? `?token=${encodeURIComponent(token)}` : ""}`
    : null;

  const downloadUrl = result.contentUrl
    ? `${baseUrl}${result.contentUrl}?disposition=attachment${token ? `&token=${encodeURIComponent(token)}` : ""}`
    : null;

  const name = typeof result.filename === "string" ? result.filename : null;
  const mimeType = typeof result.mimeType === "string" ? result.mimeType : null;
  const previewAdapter = createUrlPreviewAdapter({
    title: name,
    originalName: name,
    mimeType,
    contentUrl,
    downloadUrl,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <FileText className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>

      <GlassCard
        variant="lite"
        className={cn("px-3 py-2", cn(DS.radius.xl, "button-rect:rounded-lg"))}
      >
        <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{result.filename}</div>
              <div className="text-xs text-muted-foreground">
                {formatSize(result.sizeBytes || 0)} · Markdown
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <GlassButton
                size="sm"
                glassVariant="ghost"
                onClick={() => setPreviewOpen(true)}
                className="h-8 w-8 p-0"
                title="预览"
              >
                <Eye className="h-4 w-4" />
              </GlassButton>
              {downloadUrl && (
                <GlassButton
                  size="sm"
                  glassVariant="ghost"
                  onClick={() => window.open(downloadUrl, "_blank")}
                  className="h-8 w-8 p-0"
                  title="下载"
                >
                  <Download className="h-4 w-4" />
                </GlassButton>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} adapter={previewAdapter} />
    </div>
  );
}
