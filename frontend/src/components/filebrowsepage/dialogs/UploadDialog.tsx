import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/dialog/dialog";
import { Progress } from "@/components/ui/progress";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { XIcon, Check, File, X, Plus } from "lucide-react";

// 上传进度信息
interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPathLabel: string;
  onSubmit: (files: FileList, onProgress?: (progress: UploadProgress) => void) => Promise<void>;
}

// 格式化文件大小
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function UploadDialog({ open, onOpenChange, targetPathLabel, onSubmit }: UploadDialogProps) {
  // 使用数组存储文件，方便增删
  const [fileList, setFileList] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  
  // 隐藏的文件输入框引用
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 计算总大小
  const totalSize = useMemo(() => {
    return fileList.reduce((sum, f) => sum + f.size, 0);
  }, [fileList]);

  const handleSubmit = async () => {
    if (fileList.length === 0) {
      setError("请选择要上传的文件");
      return;
    }

    setLoading(true);
    setError("");
    setProgress(null);

    try {
      // 将 File[] 转换为 FileList 类似对象
      const dt = new DataTransfer();
      fileList.forEach((f) => dt.items.add(f));
      await onSubmit(dt.files, (p) => setProgress(p));
      toast.success("上传成功");
      onOpenChange(false);
      setFileList([]);
      setProgress(null);
    } catch (err: any) {
      setError(err?.message || "上传失败（后端未实现或发生错误）");
    } finally {
      setLoading(false);
    }
  };

  // 触发文件选择
  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 添加文件（追加模式）
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFileList((prev) => {
        // 去重：按文件名+大小判断
        const existing = new Set(prev.map((f) => `${f.name}_${f.size}`));
        const unique = newFiles.filter((f) => !existing.has(`${f.name}_${f.size}`));
        return [...prev, ...unique];
      });
    }
    setError("");
    // 重置 input 以便再次选择相同文件
    e.target.value = "";
  }, []);

  // 移除单个文件
  const removeFile = useCallback((index: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 对话框关闭时重置状态
  useEffect(() => {
    if (!open) {
      setFileList([]);
      setError("");
      setProgress(null);
      setLoading(false);
    }
  }, [open]);

  // 右上角添加文件按钮
  const addButton = (
    <GlassButton
      size="icon"
      glassVariant="lite"
      onClick={triggerFileSelect}
      disabled={loading}
      title="添加文件"
    >
      <Plus className="h-4 w-4" />
    </GlassButton>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[560px] h-[420px] flex flex-col" 
        showCloseButton={false}
      >
        {/* 隐藏的文件输入框 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <GlassCard variant="lite" className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogHeader>
                <DialogTitle>上传文件</DialogTitle>
                <DialogDescription>
                  目标文件夹：{targetPathLabel || "当前文件库根目录"}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="shrink-0 self-center">
              {addButton}
            </div>
          </div>
        </GlassCard>

        {/* 文件列表区域 */}
        <GlassCard variant="lite" className="flex-1 overflow-hidden">
        <div className="h-full border rounded-md bg-muted/30 overflow-hidden">
          {fileList.length === 0 ? (
            <div 
              className="flex h-full flex-col items-center justify-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={triggerFileSelect}
            >
              <Plus className="h-8 w-8 mb-2 opacity-50" />
              <span>点击添加文件</span>
              <span className="text-xs mt-1 opacity-70">或使用右上角按钮</span>
            </div>
          ) : (
            <div className="h-full overflow-y-auto px-2 py-2 text-sm">
              {/* 统计信息 */}
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
                <span>已选择 {fileList.length} 个文件</span>
                <span>共 {formatBytes(totalSize)}</span>
              </div>
              {/* 文件列表 */}
              <div className="space-y-1.5">
                {fileList.map((file, index) => (
                  <GlassCard
                    key={`${file.name}_${file.size}_${index}`}
                    variant="ghost"
                    className="w-full px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate" title={file.name}>{file.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                      {!loading && (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>
        </GlassCard>

        {/* 上传进度显示 */}
        {loading && progress && (
          <GlassCard variant="lite" className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>上传中...</span>
                <span>{formatBytes(progress.loaded)} / {formatBytes(progress.total)} ({progress.percent}%)</span>
              </div>
              <Progress value={progress.percent} className="h-2" />
            </div>
          </GlassCard>
        )}

        {error && (
          <GlassCard variant="lite" className="p-3">
            <div className="text-sm text-red-500">{error}</div>
          </GlassCard>
        )}

        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
          leftButtonGlassVariant="lite"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={() => { if (!loading) handleSubmit(); }}
          rightButtonGlassVariant="lite"
        />
      </DialogContent>
    </Dialog>
  );
}
