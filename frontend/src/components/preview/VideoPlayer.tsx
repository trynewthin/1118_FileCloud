import { useEffect, useRef, useState, useCallback, type PointerEvent } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
}

// 通用视频播放器组件：将视频层与浮动操作层进行拆分
export function VideoPlayer({ src, title, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekingPercent, setSeekingPercent] = useState<number | null>(null);

  // 缓冲状态与下载速度
  const [isBuffering, setIsBuffering] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState<string>("");
  const lastBufferedRef = useRef<{ time: number; bytes: number } | null>(null);

  // 时间格式化：秒 -> mm:ss 或 hh:mm:ss
  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return "00:00";
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  };

  // 任意用户交互：显示控制栏并启动自动隐藏定时器
  const handleUserInteract = () => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const togglePlay = () => {
    handleUserInteract();
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    handleUserInteract();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const toggleFullscreen = () => {
    handleUserInteract();
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const anyVideo = videoEl as any;

    // 已在系统全屏中：尝试退出
    if (document.fullscreenElement) {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
      return;
    }
    if (anyVideo.webkitDisplayingFullscreen) {
      anyVideo.webkitExitFullscreen?.();
      setIsFullscreen(false);
      return;
    }

    // 进入全屏：优先使用标准 API，其次使用 iOS Safari 的 webkitEnterFullscreen
    if (videoEl.requestFullscreen) {
      videoEl
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
      return;
    }

    if (typeof anyVideo.webkitEnterFullscreen === "function") {
      try {
        anyVideo.webkitEnterFullscreen();
        setIsFullscreen(true);
      } catch {
        // 忽略 iOS 下的全屏异常
      }
    }
  };

  const handleSeekCommit = (value: number) => {
    const el = videoRef.current;
    if (!el || duration <= 0) {
      return;
    }
    const target = (value / 100) * duration;
    el.currentTime = target;
    setCurrentTime(target);
  };

  // 进度条开始拖动
  const handleSeekStart = (event: PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    handleUserInteract();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const value = clamped * 100;
    setIsSeeking(true);
    setSeekingPercent(value);
  };

  // 进度条拖动中
  const handleSeekMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isSeeking || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const value = clamped * 100;
    setSeekingPercent(value);
  };

  // 进度条结束拖动并提交
  const handleSeekEnd = () => {
    if (!isSeeking || duration <= 0) return;
    const value = seekingPercent ?? 0;
    setIsSeeking(false);
    setSeekingPercent(null);
    handleSeekCommit(value);
  };

  // 进度条拖动被取消（不提交，仅复位拖动状态）
  const handleSeekCancel = () => {
    if (!isSeeking) return;
    setIsSeeking(false);
    setSeekingPercent(null);
  };

  // 自定义进度条点击跳转
  const handleProgressBarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const value = clamped * 100;
    handleSeekCommit(value);
  };

  // 监听全屏变化，保持状态同步（兼容桌面与 iOS Safari）
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);

    const video = videoRef.current as any;
    const handleWebkitBegin = () => setIsFullscreen(true);
    const handleWebkitEnd = () => setIsFullscreen(false);

    if (video) {
      video.addEventListener("webkitbeginfullscreen", handleWebkitBegin);
      video.addEventListener("webkitendfullscreen", handleWebkitEnd);
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      if (video) {
        video.removeEventListener("webkitbeginfullscreen", handleWebkitBegin);
        video.removeEventListener("webkitendfullscreen", handleWebkitEnd);
      }
    };
  }, []);

  // 格式化下载速度
  const formatSpeed = useCallback((bytesPerSec: number): string => {
    if (bytesPerSec <= 0) return "";
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    }
    return `${bytesPerSec.toFixed(0)} B/s`;
  }, []);

  // 计算已缓冲的字节数（基于 buffered 时间范围和 duration 估算）
  const getBufferedBytes = useCallback((video: HTMLVideoElement, totalSize: number): number => {
    if (!video.buffered.length || video.duration <= 0) return 0;
    let bufferedTime = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      bufferedTime += video.buffered.end(i) - video.buffered.start(i);
    }
    // 按时间比例估算字节数
    return (bufferedTime / video.duration) * totalSize;
  }, []);

  // 监听视频缓冲事件
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);
    const handleSeeking = () => setIsBuffering(true);
    const handleSeeked = () => setIsBuffering(false);

    // 监听 progress 事件计算下载速度
    const handleProgress = () => {
      // 尝试从响应头获取文件大小，这里用一个估算值
      // 实际上浏览器不暴露这个信息，我们用 duration * 估算码率
      const estimatedBitrate = 5 * 1024 * 1024; // 假设 5 Mbps 码率
      const estimatedSize = video.duration * estimatedBitrate / 8;
      
      if (estimatedSize <= 0) return;
      
      const currentBuffered = getBufferedBytes(video, estimatedSize);
      const now = Date.now();
      
      if (lastBufferedRef.current) {
        const timeDiff = (now - lastBufferedRef.current.time) / 1000;
        const bytesDiff = currentBuffered - lastBufferedRef.current.bytes;
        
        if (timeDiff > 0.1 && bytesDiff > 0) {
          const speed = bytesDiff / timeDiff;
          setDownloadSpeed(formatSpeed(speed));
        }
      }
      
      lastBufferedRef.current = { time: now, bytes: currentBuffered };
    };

    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("progress", handleProgress);

    return () => {
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("progress", handleProgress);
    };
  }, [formatSpeed, getBufferedBytes]);

  const hasStarted = playing || currentTime > 0;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const sliderValue = progressPercent;
  const displayPercent = isSeeking && seekingPercent !== null ? seekingPercent : sliderValue;

  // 视频层：仅负责渲染 video
  // 浮动操作层：叠加在顶部/底部，负责交互
  return (
    <div
      className={
        "flex flex-col items-center justify-center w-full h-full " +
        (isFullscreen ? "bg-black" : "")
      }
    >
      <div
        className={
          "w-full flex flex-col gap-3 " + (isFullscreen ? "max-w-none h-full" : "max-w-5xl")
        }
      >
        <div
          className={cn(
            "relative w-full overflow-hidden",
            isFullscreen ? "h-full" : "aspect-video"
          )}
          onMouseMove={handleUserInteract}
          onTouchStart={handleUserInteract}
          onClick={handleUserInteract}
        >
          {/* 视频层 */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            src={src}
            poster={poster}
            preload="metadata"
            playsInline
            onTimeUpdate={(e) => {
              setCurrentTime(e.currentTarget.currentTime);
            }}
            onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
            onEnded={() => setPlaying(false)}
          >
            您的浏览器不支持视频播放。
          </video>

          {/* 覆盖点击区域：切换播放 */}
          <button
            type="button"
            className="absolute inset-0 focus:outline-none"
            onClick={togglePlay}
          />

          {/* 初始大播放按钮：仅在尚未开始播放时显示 */}
          {!playing && currentTime === 0 && !isBuffering && (
            <button
              type="button"
              onClick={togglePlay}
              className="pointer-events-auto absolute inset-0 flex items-center justify-center"
            >
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white shadow-lg">
                <Play className="w-8 h-8" />
              </span>
            </button>
          )}

          {/* 缓冲加载指示器：视频卡顿/缓冲时居中显示 */}
          {isBuffering && hasStarted && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 rounded-xl bg-black/70 px-5 py-4 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <div className="text-xs text-white/90">
                  {downloadSpeed ? (
                    <span>缓冲中… {downloadSpeed}</span>
                  ) : (
                    <span>缓冲中…</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 顶部标题层：与底部控制层风格接近的渐变背景（仅在开始播放后出现） */}
          {hasStarted && (
            <div
              className={
                "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 pt-3 pb-6 text-xs text-white transition-opacity duration-200 " +
                (showControls ? "opacity-100" : "opacity-0")
              }
            >
              <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 pointer-events-auto">
                {title && (
                  <div className="truncate" title={title}>
                    {title}
                  </div>
                )}

                {/* 静音按钮：与标题同行垂直居中 */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-white"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* 浮动操作层：底部控制条（仅在开始播放后出现） */}
          {hasStarted && (
            <div
              className={
                "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-4 pt-2 text-xs text-white transition-opacity duration-200 " +
                (showControls ? "opacity-100" : "opacity-0")
              }
            >
              <div className="flex flex-col gap-2 max-w-5xl mx-auto pointer-events-auto">
                {/* 底部一行：左播放，中间进度条+时间，右全屏 */}
                <div className="flex items-center gap-3">
                  {/* 左侧播放按钮 */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center text-white"
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  {/* 中间进度条 + 下方时间 */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* 自定义可拖动线条进度条 */}
                    <div
                      className="relative h-1 rounded-full bg-white/20 cursor-pointer overflow-hidden touch-none"
                      onClick={handleProgressBarClick}
                      onPointerDown={handleSeekStart}
                      onPointerMove={handleSeekMove}
                      onPointerUp={handleSeekEnd}
                      onPointerCancel={handleSeekCancel}
                      onPointerLeave={handleSeekCancel}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-primary"
                        style={{ width: `${displayPercent}%` }}
                      />
                      <div
                        className="absolute -top-1.5 h-3 w-3 rounded-full bg-primary shadow-md"
                        style={{ left: `${displayPercent}%`, transform: "translateX(-50%)" }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] tabular-nums text-white/90">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* 右侧全屏按钮 */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center text-white"
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
