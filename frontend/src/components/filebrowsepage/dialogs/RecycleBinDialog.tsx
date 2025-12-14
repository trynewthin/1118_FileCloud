import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, RotateCcw, XCircle, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/dialog/dialog";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import type { TrashEntry } from "@/lib/api/files";
import { listTrashEntries } from "@/lib/api/files";

interface RecycleBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId: number | null;
  onRestore: (id: string) => Promise<any>;
  onDestroy: (id: string) => Promise<any>;
}

export function RecycleBinDialog({
  open,
  onOpenChange,
  libraryId,
  onRestore,
  onDestroy,
}: RecycleBinDialogProps) {
  const [items, setItems] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  useEffect(() => {
    const load = async () => {
      if (!open || !libraryId) {
        setItems([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await listTrashEntries(libraryId);
        setItems(res.items);
      } catch (err: any) {
        setError(err?.message || "加载回收站失败");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, libraryId]);

  const handleRestore = async (id: string) => {
    setWorkingId(id);
    try {
      await onRestore(id);
      toast.success("已还原");
      if (libraryId) {
        const res = await listTrashEntries(libraryId);
        setItems(res.items);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "还原失败");
    } finally {
      setWorkingId(null);
    }
  };

  const handleDestroy = async (id: string) => {
    if (!window.confirm("确认要彻底删除该条目吗？此操作不可恢复。")) return;
    setWorkingId(id);
    try {
      await onDestroy(id);
      toast.success("已彻底删除");
      if (libraryId) {
        const res = await listTrashEntries(libraryId);
        setItems(res.items);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "删除失败");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[520px] flex flex-col" showCloseButton={false}>
        <GlassCard variant="lite" className="p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              回收站
            </DialogTitle>
            <DialogDescription>
              显示当前文件库中已删除的文件和文件夹，可以在这里进行还原或彻底删除操作。
            </DialogDescription>
          </DialogHeader>
        </GlassCard>

        <GlassCard variant="lite" className="flex-1 overflow-hidden">
        <div className="h-full border rounded-md bg-muted/30 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              加载回收站...
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              加载失败
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              回收站为空
            </div>
          ) : (
            <div className="h-full overflow-y-auto px-2 py-2 text-sm">
              <div className="space-y-2">
                {items.map((item) => (
                  <GlassCard
                    key={item.id}
                    variant="ghost"
                    className="w-full px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("truncate font-medium", item.is_directory && "text-blue-600")}
                          title={item.relative_path}
                        >
                          {item.relative_path}
                        </span>
                        {item.is_directory && (
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            文件夹
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground flex flex-wrap gap-2">
                        <span>删除时间：{item.deleted_at || "未知"}</span>
                        {!item.is_directory && <span>大小：{formatSize(item.size_bytes)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 mt-2 sm:mt-0">
                      <GlassButton
                        glassVariant="lite"
                        className="h-8 px-3"
                        disabled={workingId === item.id}
                        onClick={() => handleRestore(item.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> 还原
                      </GlassButton>
                      <GlassButton
                        glassVariant="lite"
                        className="h-8 px-3 text-red-600 hover:text-red-700 bg-destructive/10 hover:bg-destructive/20"
                        disabled={workingId === item.id}
                        onClick={() => handleDestroy(item.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> 彻底删除
                      </GlassButton>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>
        </GlassCard>

        <DialogFooter
          rightButtonIcon={<XIcon className="h-4 w-4" />}
          onRightButtonClick={() => onOpenChange(false)}
          rightButtonGlassVariant="lite"
        >
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
