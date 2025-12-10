import { useState, useEffect, useCallback } from "react";
import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { VideoPlayer } from "@/components/preview/VideoPlayer";
import { GlassButton } from "@/components/common/GlassButton";
import { Loader2, RefreshCw, Play, AlertCircle } from "lucide-react";
import {
  getTranscodeState,
  startTranscode,
  type TranscodeState,
} from "@/lib/api/transcode";
import { toast } from "sonner";

interface VideoPreviewProps {
  entry: FileEntry;
}

// 需要转码的格式
const TRANSCODE_EXTENSIONS = ["mkv", "avi", "wmv", "flv", "mov", "webm", "ogv"];

// 文件视频预览：负责构造流式播放地址并交给通用播放器渲染
export function VideoPreview({ entry }: VideoPreviewProps) {
  const token = getAuthToken();
  const ext = entry.extension?.toLowerCase() ?? "";
  const needsTranscode = TRANSCODE_EXTENSIONS.includes(ext);

  // 转码状态
  const [transcodeState, setTranscodeState] = useState<TranscodeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [useTranscoded, setUseTranscoded] = useState(false);

  // 获取转码状态
  const fetchTranscodeState = useCallback(async () => {
    if (!needsTranscode) return;
    try {
      const state = await getTranscodeState(entry.id);
      setTranscodeState(state);
      // 如果已有转码版本，默认使用转码版本
      if (state.hasTranscodedVersion) {
        setUseTranscoded(true);
      }
    } catch {
      // 忽略错误
    }
  }, [entry.id, needsTranscode]);

  // 初始化时获取转码状态
  useEffect(() => {
    fetchTranscodeState();
  }, [fetchTranscodeState]);

  // 轮询转码进度
  useEffect(() => {
    if (!transcodeState) return;
    if (transcodeState.status !== "pending" && transcodeState.status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const state = await getTranscodeState(entry.id);
        setTranscodeState(state);
        if (state.status === "completed") {
          setUseTranscoded(true);
          toast.success("转码完成，已切换到兼容格式");
        } else if (state.status === "failed") {
          toast.error(`转码失败: ${state.errorMessage || "未知错误"}`);
        }
      } catch {
        // 忽略错误
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [entry.id, transcodeState?.status]);

  // 触发转码
  const handleStartTranscode = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await startTranscode(entry.id);
      toast.success("转码任务已创建");
      // 刷新状态
      await fetchTranscodeState();
    } catch (err: any) {
      toast.error(err.message || "创建转码任务失败");
    } finally {
      setLoading(false);
    }
  };

  // 切换播放源
  const toggleSource = () => {
    setUseTranscoded(!useTranscoded);
  };

  // 构建播放 URL
  const streamPath = useTranscoded
    ? `/file-content/${entry.id}/stream/transcoded${token ? `?token=${encodeURIComponent(token)}` : ""}`
    : `/file-content/${entry.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const url = buildApiUrl(streamPath);

  const thumbnailPath = token
    ? `/file-content/${entry.id}/thumbnail?token=${encodeURIComponent(token)}`
    : `/file-content/${entry.id}/thumbnail`;
  const thumbnailUrl = buildApiUrl(thumbnailPath);

  // 渲染转码按钮
  const renderTranscodeButton = () => {
    if (!needsTranscode) return null;
    
    // 还在加载状态
    if (!transcodeState) {
      return (
        <GlassButton size="sm" glassVariant="lite" disabled className="gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          检查中...
        </GlassButton>
      );
    }

    const { status, progress, hasTranscodedVersion } = transcodeState;

    // 已有转码版本：显示切换按钮
    if (hasTranscodedVersion) {
      return (
        <GlassButton
          size="sm"
          glassVariant="lite"
          onClick={toggleSource}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {useTranscoded ? "切换原始格式" : "切换兼容格式"}
        </GlassButton>
      );
    }

    // 转码中：显示进度
    if (status === "pending" || status === "processing") {
      return (
        <GlassButton
          size="sm"
          glassVariant="lite"
          disabled
          className="gap-2"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          转码中 {progress ?? 0}%
        </GlassButton>
      );
    }

    // 转码失败：显示重试按钮
    if (status === "failed") {
      return (
        <GlassButton
          size="sm"
          glassVariant="lite"
          onClick={handleStartTranscode}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          重新转码
        </GlassButton>
      );
    }

    // 未转码：显示转码按钮
    return (
      <GlassButton
        size="sm"
        glassVariant="lite"
        onClick={handleStartTranscode}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        生成兼容格式
      </GlassButton>
    );
  };

  return (
    <div className="flex flex-col w-full">
      {/* 视频播放器 */}
      <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
        <VideoPlayer
          src={url}
          title={entry.original_name}
          poster={thumbnailUrl}
          key={useTranscoded ? "transcoded" : "original"}
        />
      </div>
      
      {/* 转码按钮：视频下方靠左对齐 */}
      {needsTranscode && (
        <div className="flex justify-start py-3">
          {renderTranscodeButton()}
        </div>
      )}
    </div>
  );
}
