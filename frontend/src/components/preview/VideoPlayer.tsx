import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

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
    const container = videoRef.current?.parentElement?.parentElement;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
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

  // 自定义进度条点击跳转
  const handleProgressBarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const value = clamped * 100;
    handleSeekCommit(value);
  };

  // 监听全屏变化，保持状态同步
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const hasStarted = playing || currentTime > 0;
  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const sliderValue = progressPercent;

  // 视频层：仅负责渲染 video
  // 浮动操作层：叠加在顶部/底部，负责交互
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black/90 p-4">
      <div className="w-full max-w-5xl flex flex-col gap-3">
        <div
          className="relative w-full bg-black overflow-hidden shadow-lg aspect-video"
          onMouseMove={handleUserInteract}
          onClick={handleUserInteract}
        >
          {/* 视频层 */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain bg-black"
            src={src}
            poster={poster}
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
          {!playing && currentTime === 0 && (
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

          {/* 顶部标题层：与底部控制层风格接近的渐变背景（仅在开始播放后出现） */}
          {hasStarted && (
            <div
              className={
                "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-3 pt-3 pb-6 text-xs text-white transition-opacity duration-200 " +
                (showControls ? "opacity-100" : "opacity-0")
              }
            >
              {title && (
                <div className="max-w-5xl mx-auto truncate" title={title}>
                  {title}
                </div>
              )}
            </div>
          )}

          {/* 顶层右上角静音按钮，仅保留图标（仅在开始播放后出现） */}
          {hasStarted && (
            <button
              type="button"
              onClick={toggleMute}
              className={
                "pointer-events-auto absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center text-white transition-opacity duration-200 " +
                (showControls ? "opacity-100" : "opacity-0")
              }
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
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
                    {/* 自定义简洁线条进度条 */}
                    <div
                      className="relative h-1 rounded-full bg-white/20 cursor-pointer overflow-hidden"
                      onClick={handleProgressBarClick}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-white"
                        style={{ width: `${sliderValue}%` }}
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
