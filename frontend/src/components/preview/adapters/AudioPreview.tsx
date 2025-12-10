import { useState, useRef, useEffect } from "react";
import type { FileEntry } from "@/lib/api/files";
import { getAuthToken, buildApiUrl } from "@/lib/api/client";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { GlassButton } from "@/components/common/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";

interface AudioPreviewProps {
  entry: FileEntry;
}

// 格式化时间 (秒 -> mm:ss)
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// 音频文件预览组件
export function AudioPreview({ entry }: AudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCover, setHasCover] = useState(true); // 假设有封面，加载失败再隐藏

  // 构建音频 URL
  const token = getAuthToken();
  const audioUrl = buildApiUrl(
    `/file-content/${entry.id}/stream${token ? `?token=${encodeURIComponent(token)}` : ""}`
  );

  // 构建封面图 URL（缩略图接口）
  const coverUrl = buildApiUrl(
    `/file-content/${entry.id}/thumbnail${token ? `?token=${encodeURIComponent(token)}` : ""}`
  );

  // 播放/暂停
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  // 静音切换
  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // 进度拖动
  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  // 音量调节
  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
      audioRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      audioRef.current.muted = false;
    }
  };

  // 监听音频事件
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onError = () => setError("音频加载失败");
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div className="w-full p-6">
      <GlassCard
        variant="lite"
        className="w-full p-6 flex flex-col items-center gap-6"
      >
        {/* 隐藏的原生音频元素 */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* 封面区域 */}
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
            {hasCover ? (
              <img
                src={coverUrl}
                alt="专辑封面"
                className="w-full h-full object-cover"
                onError={() => setHasCover(false)}
              />
            ) : (
              <Music className="w-16 h-16 text-primary/60" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-center truncate max-w-full px-4">
            {entry.original_name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {entry.mime_type || "音频文件"}
          </p>
        </div>

        {error ? (
          <div className="text-center text-destructive py-4 w-full">{error}</div>
        ) : (
          <>
            {/* 进度条 */}
            <div className="mb-4 w-full">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center justify-center gap-4">
              {/* 播放/暂停 */}
              <GlassButton
                glassVariant="lite"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </GlassButton>
            </div>

            {/* 音量控制 */}
            <div className="flex items-center justify-center gap-2 mt-6 w-full">
              <GlassButton
                glassVariant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </GlassButton>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-24 cursor-pointer"
              />
            </div>
          </>
        )}
      </GlassCard>
    </div>
  );
}
