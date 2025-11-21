import { useState } from "react";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface NewLibraryDialogProps {
  onSuccess?: () => void;
}

export function NewLibraryDialog({ onSuccess }: NewLibraryDialogProps) {
  const [open, setOpen] = useState(false);
  const [rootPath, setRootPath] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { create, loading } = useFileLibraries();
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPath) return;
    
    setError("");
    try {
      await create({ rootPath, displayName: displayName || undefined });
      setOpen(false);
      setRootPath("");
      setDisplayName("");
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || "创建失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          新建文件库
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建文件库</DialogTitle>
            <DialogDescription>
              添加一个新的本地目录作为文件库。确保后端服务有权限访问该目录。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rootPath" className="text-right">
                根路径
              </Label>
              <Input
                id="rootPath"
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="例如: D:\Photos"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="displayName" className="text-right">
                显示名称
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="可选"
                className="col-span-3"
              />
            </div>
          </div>
          {error && <div className="text-sm text-red-500 mb-4">{error}</div>}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
