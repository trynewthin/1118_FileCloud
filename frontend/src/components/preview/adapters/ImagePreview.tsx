import { useState } from "react";
import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { ImageIcon, AlertCircle, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { GlassButton } from "@/components/common/GlassButton";

interface ImagePreviewProps {
  entry: FileEntry;
}

// 图片文件预览组件
export function ImagePreview({ entry }: ImagePreviewProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // 构建图片 URL
  const token = getAuthToken();
  const imageUrl = buildApiUrl(
    `/file-content/${entry.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
  );

  // 缩放控制
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const rotate = () => setRotation((r) => (r + 90) % 360);
  const resetView = () => {
    setScale(1);
    setRotation(0);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[300px] p-8">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-destructive">图片加载失败</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{entry.original_name}</span>
        </div>
        <div className="flex items-center gap-1">
          <GlassButton
            glassVariant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomOut}
            title="缩小"
            disabled={scale <= 0.25}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </GlassButton>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <GlassButton
            glassVariant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomIn}
            title="放大"
            disabled={scale >= 3}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </GlassButton>
          <GlassButton
            glassVariant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={rotate}
            title="旋转"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </GlassButton>
          {(scale !== 1 || rotation !== 0) && (
            <GlassButton
              glassVariant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={resetView}
            >
              重置
            </GlassButton>
          )}
        </div>
      </div>

      {/* 图片容器 */}
      <div className="relative w-full min-h-[300px] max-h-[70vh] overflow-auto bg-muted/20 flex items-center justify-center p-4">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground animate-pulse" />
          </div>
        )}
        <img
          src={imageUrl}
          alt={entry.original_name}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            opacity: loading ? 0 : 1,
          }}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
