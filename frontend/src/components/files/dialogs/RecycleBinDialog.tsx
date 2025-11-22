import { useEffect, useState } from "react";
import { Trash2, RotateCcw, XCircle, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      if (libraryId) {
        const res = await listTrashEntries(libraryId);
        setItems(res.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  };

  const handleDestroy = async (id: string) => {
    if (!window.confirm("确认要彻底删除该条目吗？此操作不可恢复。")) return;
    setWorkingId(id);
    try {
      await onDestroy(id);
      if (libraryId) {
        const res = await listTrashEntries(libraryId);
        setItems(res.items);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[520px] flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            回收站
          </DialogTitle>
          <DialogDescription>
            显示当前文件库中已删除的文件和文件夹，可以在这里进行还原或彻底删除操作。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 border rounded-md bg-muted/30 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              加载回收站...
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-red-500 text-sm">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              回收站为空
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="divide-y text-sm">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-background/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("truncate font-medium", item.is_directory && "text-blue-600")}
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={workingId === item.id}
                        onClick={() => handleRestore(item.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> 还原
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={workingId === item.id}
                        onClick={() => handleDestroy(item.id)}
                      >
                        <XCircle className="h-3 w-3 mr-1" /> 彻底删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter
          rightButtonIcon={<XIcon className="h-4 w-4" />}
          onRightButtonClick={() => onOpenChange(false)}
          rightButtonGlassVariant="ghost"
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
