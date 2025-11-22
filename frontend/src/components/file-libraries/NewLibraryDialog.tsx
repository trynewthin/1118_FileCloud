import { useState } from "react";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/common/GlassButton";
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
import { Plus, FolderSearch } from "lucide-react";
import { FolderPickerDialog } from "@/components/files/dialogs/FolderPickerDialog";

interface NewLibraryDialogProps {
  onSuccess?: () => void;
}

export function NewLibraryDialog({ onSuccess }: NewLibraryDialogProps) {
  const [open, setOpen] = useState(false);
  const [rootPath, setRootPath] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { create, loading } = useFileLibraries();
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPath) return;
    
    setError("");
    try {
      await create({ rootPath, displayName: displayName || undefined });
      setOpen(false);
      setRootPath("");
      setDisplayName("");
      alert("文件库创建成功，正在后台建立索引，稍后即可查看文件内容。");
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || "创建失败");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <GlassButton className="gap-2" glassVariant="lite">
            <Plus className="h-4 w-4" />
            新建文件库
          </GlassButton>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>新建文件库</DialogTitle>
              <DialogDescription>
                添加一个新的本地目录作为文件库。确保后端服务有权限访问该目录。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="grid gap-2">
                <Label htmlFor="rootPath">
                  根路径 <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="rootPath"
                    value={rootPath}
                    onChange={(e) => setRootPath(e.target.value)}
                    placeholder="例如: D:\Photos"
                    className="flex-1 bg-background/50 border-white/10 focus:bg-background/80"
                  />
                  <GlassButton type="button" glassVariant="ghost" size="icon" onClick={() => setPickerOpen(true)} title="选择服务器目录">
                    <FolderSearch className="h-4 w-4" />
                  </GlassButton>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayName">
                  显示名称
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="可选，默认为未命名"
                  className="bg-background/50 border-white/10 focus:bg-background/80"
                />
              </div>
            </div>
            {error && <div className="text-sm text-red-500 mb-4">{error}</div>}
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "创建中..." : "立即创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FolderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="system"
        initialPath={rootPath}
        onSubmit={(val) => setRootPath(val)}
        title="选择服务器目录"
        description="请选择服务器上的真实目录作为文件库根路径。"
      />
    </>
  );
}
