import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackgroundSettings, type BackgroundMode } from "@/hooks/useBackgroundSettings";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Sparkles, XIcon, Check } from "lucide-react";

interface BackgroundSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 背景设置对话框
 * - 在光晕背景与图片背景之间切换
 * - 支持配置图片 URL
 */
export function BackgroundSettingsDialog({ open, onOpenChange }: BackgroundSettingsDialogProps) {
  const { settings, setMode, setImageUrl } = useBackgroundSettings();

  const [mode, setModeState] = useState<BackgroundMode>("glow");
  const [imageUrl, setImageUrlState] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setModeState(settings.mode);
    setImageUrlState(settings.imageUrl ?? "");
    setError("");
  }, [open, settings.mode, settings.imageUrl]);

  const handleSelectMode = (nextMode: BackgroundMode) => {
    setModeState(nextMode);
    if (nextMode === "glow") {
      setError("");
    }
  };

  const handleSubmit = () => {
    if (mode === "image") {
      const trimmed = imageUrl.trim();
      if (!trimmed) {
        setError("图片地址不能为空");
        return;
      }
      // 简单校验，避免明显错误
      try {
        // 若不是绝对 URL，也允许相对路径，故仅在有协议时校验
        if (/^https?:\/\//i.test(trimmed)) {
          // eslint-disable-next-line no-new
          new URL(trimmed);
        }
      } catch {
        setError("图片地址格式不正确");
        return;
      }

      setImageUrl(trimmed);
    }

    setMode(mode);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px] h-[360px] flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>背景设置</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-5 py-4">
          <div className="space-y-2">
            <Label>背景模式</Label>
            <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => handleSelectMode("glow")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                  mode === "glow"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>光晕背景</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode("image")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                  mode === "image"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>图片背景</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              光晕背景为默认的动态光效，图片背景适合使用自定义壁纸。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bg-image-url">图片地址 URL</Label>
            <Input
              id="bg-image-url"
              placeholder="例如：https://example.com/wallpaper.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrlState(e.target.value)}
              disabled={mode !== "image"}
            />
            {error && <div className="text-xs text-red-500">{error}</div>}
            <p className="text-xs text-muted-foreground">
              仅在选择“图片背景”模式时生效，图片需能被当前浏览器访问。
            </p>
          </div>
        </div>

        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={handleCancel}
          leftButtonGlassVariant="ghost"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        >
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
