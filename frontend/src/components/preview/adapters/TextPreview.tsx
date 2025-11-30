import { useState, useEffect } from "react";
import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { FileText, AlertCircle } from "lucide-react";

interface TextPreviewProps {
  entry: FileEntry;
}

// 文本文件预览组件
export function TextPreview({ entry }: TextPreviewProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        const url = buildApiUrl(
          `/file-content/${entry.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
        );
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("加载文件内容失败");
        }
        
        const text = await response.text();
        // 限制显示长度，避免超大文件卡顿
        const maxLength = 500000; // 约 500KB 文本
        if (text.length > maxLength) {
          setContent(text.slice(0, maxLength) + "\n\n... (文件过大，仅显示前 500KB)");
        } else {
          setContent(text);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [entry.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[300px] p-8">
        <FileText className="w-12 h-12 text-muted-foreground animate-pulse mb-4" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[300px] p-8">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 文件名标题 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{entry.original_name}</span>
      </div>
      
      {/* 文本内容 */}
      <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words overflow-x-auto max-h-[70vh] overflow-y-auto bg-background/50">
        {content || "(空文件)"}
      </pre>
    </div>
  );
}
