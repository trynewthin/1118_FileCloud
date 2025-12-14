import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackgroundSettings, type BackgroundMode, type ImageSourceType } from "@/hooks/useBackgroundSettings";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Sparkles, XIcon, Check, Upload, Link, Trash2, CheckCircle2 } from "lucide-react";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import {
  saveBackgroundImage,
  getAllBackgroundImages,
  deleteBackgroundImage,
  createImageUrl,
  type StoredBackgroundImage,
} from "@/lib/storage/backgroundStorage";
import { toast } from "sonner";

interface BackgroundSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 背景设置对话框
 * - 在光晕背景与图片背景之间切换
 * - 支持配置图片 URL 或上传本地图片（存储在后端）
 * - 支持管理已上传的背景图片
 */
export function BackgroundSettingsDialog({ open, onOpenChange }: BackgroundSettingsDialogProps) {
  const { settings, setSettings } = useBackgroundSettings();

  const [mode, setModeState] = useState<BackgroundMode>("glow");
  const [imageSourceType, setImageSourceTypeState] = useState<ImageSourceType>("url");
  const [imageUrl, setImageUrlState] = useState("");
  const [selectedLocalId, setSelectedLocalId] = useState("");
  const [error, setError] = useState("");
  const [localImages, setLocalImages] = useState<StoredBackgroundImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 用于跟踪是否已初始化，避免重复初始化
  const initializedRef = useRef(false);

  // 加载图片列表（从后端）
  const loadLocalImages = useCallback(async () => {
    try {
      const images = await getAllBackgroundImages();
      setLocalImages(images);
    } catch (err) {
      console.error("加载背景图片失败:", err);
    }
  }, []);

  // 初始化弹窗状态
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    // 只在打开时初始化一次
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    setModeState(settings.mode);
    setImageSourceTypeState(settings.imageSourceType);
    setImageUrlState(settings.imageUrl ?? "");
    setSelectedLocalId(settings.localImageId ?? "");
    setError("");
    loadLocalImages();
  }, [open, settings.mode, settings.imageSourceType, settings.imageUrl, settings.localImageId, loadLocalImages]);

  const handleSelectMode = (nextMode: BackgroundMode) => {
    setModeState(nextMode);
    if (nextMode === "glow") {
      setError("");
    }
  };

  const handleSelectSourceType = (type: ImageSourceType) => {
    setImageSourceTypeState(type);
    setError("");
  };

  // 处理图片上传
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
      // 重置 input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 删除本地图片
  const handleDeleteImage = async (id: string) => {
    try {
      await deleteBackgroundImage(id);
      // 如果删除的是当前选中的，清空选择
      if (selectedLocalId === id) {
        setSelectedLocalId("");
      }
      await loadLocalImages();
      toast.success("背景图片已删除");
    } catch (err) {
      toast.error("删除背景图片失败");
    }
  };

  const handleSubmit = () => {
    if (mode === "image") {
      if (imageSourceType === "url") {
        const trimmed = imageUrl.trim();
        if (!trimmed) {
          setError("图片地址不能为空");
          return;
        }
        // 简单校验
        try {
          if (/^https?:\/\//i.test(trimmed)) {
            new URL(trimmed);
          }
        } catch {
          setError("图片地址格式不正确");
          return;
        }
      } else {
        // local 模式
        if (!selectedLocalId) {
          setError("请选择一张本地背景图片");
          return;
        }
      }
    }

    setSettings({
      mode,
      imageSourceType,
      imageUrl: imageUrl.trim(),
      localImageId: selectedLocalId,
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] h-[520px] flex flex-col"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>背景设置</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 py-2 overflow-hidden">
          {/* 背景模式选择 */}
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
          </div>

          {/* 图片来源选择（仅在图片模式下显示） */}
          {mode === "image" && (
            <div className="space-y-2">
              <Label>图片来源</Label>
              <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => handleSelectSourceType("local")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                    imageSourceType === "local"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>本地上传</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSourceType("url")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all",
                    imageSourceType === "url"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link className="h-3.5 w-3.5" />
                  <span>外部链接</span>
                </button>
              </div>
            </div>
          )}

          {/* URL 输入（仅在图片模式 + URL 来源时显示） */}
          {mode === "image" && imageSourceType === "url" && (
            <div className="space-y-2">
              <Label htmlFor="bg-image-url">图片地址 URL</Label>
              <Input
                id="bg-image-url"
                placeholder="例如：https://example.com/wallpaper.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrlState(e.target.value)}
              />
              {error && <div className="text-xs text-red-500">{error}</div>}
              <p className="text-xs text-muted-foreground">
                图片需能被当前浏览器访问。
              </p>
            </div>
          )}

          {/* 本地图片管理（仅在图片模式 + 本地来源时显示） */}
          {mode === "image" && imageSourceType === "local" && (
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between">
                <Label>本地背景图片</Label>
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
              </div>
              
              {error && <div className="text-xs text-red-500">{error}</div>}

              {/* 图片列表 */}
              <div className="flex-1 border rounded-md bg-muted/30 overflow-hidden">
                <div className="h-full overflow-y-auto p-2">
                  {localImages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      暂无本地背景图片，点击上方按钮上传
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {localImages.map((img) => (
                        <GlassCard
                          key={img.id}
                          variant="ghost"
                          className={cn(
                            "relative aspect-video overflow-hidden cursor-pointer group transition-all",
                            selectedLocalId === img.id && "ring-2 ring-primary"
                          )}
                          onClick={() => setSelectedLocalId(img.id)}
                        >
                          <img
                            src={createImageUrl(img)}
                            alt={img.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          {/* 选中标记 */}
                          {selectedLocalId === img.id && (
                            <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                          )}
                          {/* 删除按钮 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(img.id);
                            }}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {/* 文件名 */}
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
          )}

          {/* 光晕模式说明 */}
          {mode === "glow" && (
            <p className="text-xs text-muted-foreground">
              光晕背景为默认的动态光效，营造通透、柔和的视觉体验。
            </p>
          )}
        </div>

        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={handleCancel}
          leftButtonGlassVariant="ghost"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        />
      </DialogContent>
    </Dialog>
  );
}
