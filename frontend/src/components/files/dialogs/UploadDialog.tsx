import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XIcon, Check } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPathLabel: string;
  onSubmit: (files: FileList) => Promise<void>;
}

export function UploadDialog({ open, onOpenChange, targetPathLabel, onSubmit }: UploadDialogProps) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) {
      e.preventDefault();
    }
    if (!files || files.length === 0) {
      setError("请选择要上传的文件");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit(files);
      onOpenChange(false);
      setFiles(null);
    } catch (err: any) {
      setError(err?.message || "上传失败（后端未实现或发生错误）");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" showCloseButton={false}>
        <form onSubmit={(e) => handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>上传文件</DialogTitle>
            <DialogDescription>
              目标文件夹：{targetPathLabel || "当前文件库根目录"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2 text-sm">
              <span className="text-muted-foreground">选择要上传的文件：</span>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-accent cursor-pointer"
              />
            </div>
            {files && files.length > 0 && (
              <div className="text-xs text-muted-foreground">
                已选择 {files.length} 个文件
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-500 mb-4">{error}</div>}

          <DialogFooter
            leftButtonIcon={<XIcon className="h-4 w-4" />}
            onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
            leftButtonGlassVariant="ghost"
            rightButtonIcon={<Check className="h-4 w-4" />}
            onRightButtonClick={() => { if (!loading) handleSubmit(null); }}
            rightButtonGlassVariant="lite"
          >
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
