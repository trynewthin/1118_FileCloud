import { useState } from "react";
import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { FileText, AlertCircle, ExternalLink } from "lucide-react";
import { GlassButton } from "@/components/common/GlassButton";

interface PdfPreviewProps {
  entry: FileEntry;
}

// PDF 文件预览组件
export function PdfPreview({ entry }: PdfPreviewProps) {
  const [error, setError] = useState(false);

  // 构建 PDF URL
  const token = getAuthToken();
  const pdfUrl = buildApiUrl(
    `/file-content/${entry.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
  );

  // 在新标签页打开
  const openInNewTab = () => {
    window.open(pdfUrl, "_blank");
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[400px] p-8">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-destructive mb-4">PDF 加载失败</p>
        <GlassButton glassVariant="lite" onClick={openInNewTab} className="gap-2">
          <ExternalLink className="w-4 h-4" />
          在新标签页打开
        </GlassButton>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 文件名标题 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{entry.original_name}</span>
        </div>
        <GlassButton
          glassVariant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={openInNewTab}
          title="在新标签页打开"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </GlassButton>
      </div>

      {/* PDF 嵌入预览 */}
      <div className="w-full h-[70vh] min-h-[400px]">
        <iframe
          src={pdfUrl}
          className="w-full h-full border-0"
          title={entry.original_name}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
}
