import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useBackgroundSettings, type BackgroundMode, type ImageSourceType } from "@/hooks/useBackgroundSettings";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Sparkles, Cloud, Upload, Link, Trash2, CheckCircle2 } from "lucide-react";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassPillSegmentedSwitch } from "@/components/common/button";
import { GlassCard } from "@/components/common/GlassCard";
import { SettingsItemCard } from "@/components/settings/SettingsItemCard";
import { SettingsGridCard } from "@/components/settings/SettingsGridCard";
import {
  saveBackgroundImage,
  getAllBackgroundImages,
  deleteBackgroundImage,
  createImageUrl,
  type StoredBackgroundImage,
} from "@/lib/storage/backgroundStorage";
import { toast } from "sonner";

export function BackgroundSettingsSection() {
  const { settings, setSettings } = useBackgroundSettings();

  const [mode, setModeState] = useState<BackgroundMode>(settings.mode);
  const [imageSourceType, setImageSourceTypeState] = useState<ImageSourceType>(settings.imageSourceType);
  const [imageUrl, setImageUrlState] = useState(settings.imageUrl ?? "");
  const [selectedLocalId, setSelectedLocalId] = useState(settings.localImageId ?? "");
  const [maskOpacity, setMaskOpacityState] = useState<number>(settings.maskOpacity ?? 0.18);
  const [blurPx, setBlurPxState] = useState<number>(settings.blurPx ?? 0);
  const [error, setError] = useState("");
  const [localImages, setLocalImages] = useState<StoredBackgroundImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLocalImages = useCallback(async () => {
    try {
      const images = await getAllBackgroundImages();
      setLocalImages(images);
    } catch (err) {
      console.error("加载背景图片失败:", err);
    }
  }, []);

  useEffect(() => {
    setModeState(settings.mode);
    setImageSourceTypeState(settings.imageSourceType);
    setImageUrlState(settings.imageUrl ?? "");
    setSelectedLocalId(settings.localImageId ?? "");
    setMaskOpacityState(typeof settings.maskOpacity === "number" ? settings.maskOpacity : 0.18);
    setBlurPxState(typeof settings.blurPx === "number" ? settings.blurPx : 0);
    setError("");
  }, [settings.mode, settings.imageSourceType, settings.imageUrl, settings.localImageId, settings.maskOpacity, settings.blurPx]);

  useEffect(() => {
    if (mode === "image" && imageSourceType === "local") {
      loadLocalImages();
    }
  }, [mode, imageSourceType, loadLocalImages]);

  const handleSelectMode = (nextMode: BackgroundMode) => {
    setModeState(nextMode);
    if (nextMode !== "image") {
      setError("");
    }

    setSettings((prev) => ({
      ...prev,
      mode: nextMode,
    }));
  };

  const handleSelectSourceType = (type: ImageSourceType) => {
    setImageSourceTypeState(type);
    setError("");

    setSettings((prev) => ({
      ...prev,
      mode: "image",
      imageSourceType: type,
    }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} 不是有效的图片文件`);
          continue;
        }
        await saveBackgroundImage(file);
      }
      await loadLocalImages();
      toast.success("背景图片上传成功");
    } catch (err) {
      toast.error("上传背景图片失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      await deleteBackgroundImage(id);
      if (selectedLocalId === id) {
        setSelectedLocalId("");
        setSettings((prev) => ({
          ...prev,
          localImageId: "",
        }));
      }
      await loadLocalImages();
      toast.success("背景图片已删除");
    } catch (err) {
      toast.error("删除背景图片失败");
    }
  };

  const validateUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "图片地址不能为空";
    }
    try {
      if (/^https?:\/\//i.test(trimmed)) {
        new URL(trimmed);
      }
    } catch {
      return "图片地址格式不正确";
    }
    return "";
  };

  return (
    <div className="space-y-3">
      <SettingsItemCard
        title="背景模式"
        description={
          mode === "glow"
            ? "光晕背景（经典）"
            : mode === "aurora"
              ? "极光背景（更炫酷）"
              : mode === "nebula"
                ? "星云背景（流体噪声）"
              : "图片背景"
        }
        action={
          <GlassPillSegmentedSwitch
            value={mode}
            onValueChange={handleSelectMode}
            options={[
              { value: "glow", label: "光晕", icon: <Sparkles className="h-3.5 w-3.5" /> },
              { value: "aurora", label: "极光" },
              { value: "nebula", label: "星云", icon: <Cloud className="h-3.5 w-3.5" /> },
              { value: "image", label: "图片", icon: <ImageIcon className="h-3.5 w-3.5" /> },
            ]}
          />
        }
      />

      <SettingsItemCard
        title="背景遮罩"
        description="用于提升前景内容可读性。"
        action={
          <div className="flex items-center gap-3">
            <Slider
              className="w-32"
              value={[Math.round(maskOpacity * 100)]}
              min={0}
              max={60}
              step={1}
              onValueChange={(v) => {
                const next = Math.min(0.95, Math.max(0, (v?.[0] ?? 0) / 100));
                setMaskOpacityState(next);
                setSettings((prev) => ({ ...prev, maskOpacity: next }));
              }}
            />
            <div className="w-12 text-right text-xs tabular-nums text-foreground/80">
              {Math.round(maskOpacity * 100)}%
            </div>
          </div>
        }
      />

      <SettingsItemCard
        title="背景模糊"
        description="手动控制背景模糊度。"
        action={
          <div className="flex items-center gap-3">
            <Slider
              className="w-32"
              value={[Math.round(blurPx)]}
              min={0}
              max={40}
              step={1}
              onValueChange={(v) => {
                const next = Math.min(80, Math.max(0, v?.[0] ?? 0));
                setBlurPxState(next);
                setSettings((prev) => ({ ...prev, blurPx: next }));
              }}
            />
            <div className="w-12 text-right text-xs tabular-nums text-foreground/80">
              {Math.round(blurPx)}px
            </div>
          </div>
        }
      />

      {mode === "image" && (
        <SettingsItemCard
          title="图片来源"
          description={imageSourceType === "local" ? "本地上传" : "外部链接"}
          action={
            <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => handleSelectSourceType("local")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                  imageSourceType === "local"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>本地</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectSourceType("url")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                  imageSourceType === "url"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Link className="h-3.5 w-3.5" />
                <span>链接</span>
              </button>
            </div>
          }
        />
      )}
      {mode === "image" && imageSourceType === "url" && (
        <SettingsGridCard title="图片地址" description="图片需能被当前浏览器访问。">
          <div className="space-y-2">
            <Label htmlFor="bg-image-url">图片地址 URL</Label>
            <Input
              id="bg-image-url"
              placeholder="例如：https://example.com/wallpaper.jpg"
              value={imageUrl}
              onChange={(e) => {
                setImageUrlState(e.target.value);
                setError("");
              }}
              onBlur={() => {
                const nextError = validateUrl(imageUrl);
                if (nextError) {
                  setError(nextError);
                  return;
                }

                setSettings((prev) => ({
                  ...prev,
                  mode: "image",
                  imageSourceType: "url",
                  imageUrl: imageUrl.trim(),
                }));
              }}
            />
            {error && <div className="text-xs text-red-500">{error}</div>}
          </div>
        </SettingsGridCard>
      )}

      {mode === "image" && imageSourceType === "local" && (
        <SettingsGridCard
          title="本地背景图片"
          description="上传、选择或删除本地背景图片。"
          rightSlot={
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <GlassButton
                size="sm"
                glassVariant="lite"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploading ? "上传中..." : "上传图片"}
              </GlassButton>
            </div>
          }
        >
          <div className="space-y-3">
            {error && <div className="text-xs text-red-500">{error}</div>}

            <div
              className={cn(
                "border bg-muted/30 overflow-hidden",
                "rounded-2xl",
                "button-rect:rounded-xl",
              )}
            >
              <div className="max-h-[320px] overflow-y-auto p-2">
                {localImages.length === 0 ? (
                  <div className="flex h-[120px] items-center justify-center text-muted-foreground text-sm">
                    暂无本地背景图片，点击右上角按钮上传
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {localImages.map((img) => (
                      <GlassCard
                        key={img.id}
                        variant="ghost"
                        className={cn(
                          "relative aspect-video overflow-hidden cursor-pointer group transition-all",
                          "rounded-xl",
                          "button-rect:rounded-lg",
                          selectedLocalId === img.id && "ring-2 ring-primary",
                        )}
                        onClick={() => {
                          setSelectedLocalId(img.id);
                          setError("");

                          setSettings((prev) => ({
                            ...prev,
                            mode: "image",
                            imageSourceType: "local",
                            localImageId: img.id,
                          }));
                        }}
                      >
                        <img
                          src={createImageUrl(img)}
                          alt={img.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        {selectedLocalId === img.id && (
                          <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(img.id);
                          }}
                          className={cn(
                            "absolute top-2 right-2",
                            "h-6 w-6",
                            "rounded-full",
                            "bg-destructive text-destructive-foreground",
                            "flex items-center justify-center",
                            "shadow-sm",
                          )}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                          <p className="text-[10px] text-white truncate">{img.name}</p>
                        </div>
                      </GlassCard>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SettingsGridCard>
      )}
    </div>
  );
}
