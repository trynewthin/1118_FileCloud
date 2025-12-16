import { useState } from "react";
import { Code, Download, ExternalLink, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DS } from "@/theme/design-system";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import type { ToolCallResult } from "./types";
import { formatSize } from "./format";

export function HtmlFileRenderer({ result }: { result: ToolCallResult }) {
  const [expanded, setExpanded] = useState(false);

  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("filecloud_auth_token")
    : null;

  // 构建完整 URL
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

  // 在新标签页打开
  const handleOpenInNewTab = () => {
    if (contentUrl) {
      window.open(contentUrl, "_blank");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Code className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>

      {/* 文件信息卡片 */}
      <GlassCard
        variant="lite"
        className={cn("px-3 py-2", cn(DS.radius.xl, "button-rect:rounded-lg"))}
      >
        <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Code className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{result.filename}</div>
              <div className="text-xs text-muted-foreground">
                {formatSize(result.sizeBytes || 0)} · HTML
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <GlassButton
                size="sm"
                glassVariant="ghost"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0"
                title={expanded ? "收起预览" : "展开预览"}
              >
                <Maximize2 className={cn("h-4 w-4 transition-transform", expanded && "rotate-45")} />
              </GlassButton>
              <GlassButton
                size="sm"
                glassVariant="ghost"
                onClick={handleOpenInNewTab}
                className="h-8 w-8 p-0"
                title="在新标签页打开"
              >
                <ExternalLink className="h-4 w-4" />
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

      {/* iframe 预览区域 */}
      {expanded && contentUrl && (
        <GlassCard
          variant="lite"
          className={cn("overflow-hidden", cn(DS.radius.xl, "button-rect:rounded-lg"))}
        >
          <div aria-hidden className="absolute inset-0 bg-background/55 dark:bg-black/45 pointer-events-none" />
          <div className="relative z-10">
            <iframe
              src={contentUrl}
              title={result.filename || "HTML 预览"}
              className="w-full h-[400px] border-0 bg-white rounded-lg"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </GlassCard>
      )}
    </div>
  );
}
