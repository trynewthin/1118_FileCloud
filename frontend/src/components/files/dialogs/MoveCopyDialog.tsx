import { useState, useEffect, useCallback } from "react";
import { Folder, ChevronRight, Home, XIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileEntry } from "@/lib/api/files";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
}

interface MoveCopyDialogProps {
  mode: "move" | "copy";
  entry: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (entry: FileEntry, targetParentId: string | null, newName?: string, password?: string) => Promise<void>;
}

export function MoveCopyDialog({ mode, entry, open, onOpenChange, onSubmit }: MoveCopyDialogProps) {
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 文件夹选择器状态
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [items, setItems] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 加载当前目录的子文件夹
  const loadFolders = useCallback(async () => {
    if (!entry) return;
    setFolderLoading(true);
    try {
      const query = currentParentId ? `?parentId=${encodeURIComponent(currentParentId)}` : "";
      const res = await apiClient.get<{ items: any[] }>(
        `/files/library/${entry.library_id}/entries${query}`
      );

      const dirs = res.items
        .filter((i: any) => i.is_directory && i.id !== entry.id) // 排除当前文件/文件夹本身
        .map((i: any) => ({
          id: i.id,
          name: i.original_name,
        }));

      // 根目录下增加一个显式的"根目录"虚拟项
      if (!currentParentId) {
        setItems([
          { id: "__ROOT__", name: "根目录（当前文件库）" },
          ...dirs,
        ]);
      } else {
        setItems(dirs);
      }
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setFolderLoading(false);
    }
  }, [entry, currentParentId]);

  // 加载初始目录的祖先路径并加载文件夹列表
  const loadInitialBreadcrumbs = useCallback(async (parentId: string) => {
    if (!entry) return;
    setFolderLoading(true);
    try {
      const res = await apiClient.get<{ entry: any; ancestors?: { id: string; name: string }[] }>(
        `/files/entries/${parentId}`
      );
      if (res.ancestors && res.ancestors.length > 0) {
        const crumbs = [...res.ancestors, { id: parentId, name: res.entry.original_name }];
        setBreadcrumbs(crumbs);
        setCurrentParentId(parentId);
      } else {
        setBreadcrumbs([{ id: parentId, name: res.entry.original_name }]);
        setCurrentParentId(parentId);
      }
    } catch {
      setCurrentParentId(null);
      setBreadcrumbs([]);
    }
    // 设置完 currentParentId 后会触发 loadFolders
  }, [entry]);

  // 初始化
  useEffect(() => {
    if (open && entry && !initialized) {
      setNewName(mode === "copy" ? entry.original_name : "");
      setError("");
      setSelectedId(null);
      setInitialized(true);

      // 展开到文件所在的目录
      if (entry.parent_id) {
        loadInitialBreadcrumbs(entry.parent_id);
      } else {
        setCurrentParentId(null);
        setBreadcrumbs([]);
        loadFolders();
      }
    }
    if (!open) {
      setInitialized(false);
      // 重置状态
      setCurrentParentId(null);
      setBreadcrumbs([]);
      setItems([]);
    }
  }, [open, entry, mode, initialized]);

  // 当 currentParentId 变化时重新加载（仅在已初始化后）
  useEffect(() => {
    if (open && initialized && currentParentId !== null) {
      loadFolders();
    }
  }, [currentParentId]);

  const handleEnter = (item: FolderItem) => {
    if (item.id === "__ROOT__") return; // 根目录虚拟项不能进入
    setCurrentParentId(item.id);
    setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    setSelectedId(null);
  };

  const handleSubmit = async () => {
    if (!entry || loading) return;

    setLoading(true);
    setError("");
    try {
      // 确定目标目录
      let targetId: string | null;
      if (selectedId === "__ROOT__" || (!selectedId && !currentParentId)) {
        targetId = null; // 根目录
      } else {
        targetId = selectedId || currentParentId;
      }

      await onSubmit(entry, targetId, newName || undefined, undefined);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "move" ? "移动文件" : "复制文件";
  const selectedName = selectedId 
    ? (selectedId === "__ROOT__" ? "根目录" : items.find(i => i.id === selectedId)?.name)
    : (currentParentId ? "当前目录" : "根目录");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[550px] flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {entry?.is_directory ? "选择目标文件夹" : `${mode === "move" ? "移动" : "复制"} "${entry?.original_name}" 到：`}
          </DialogDescription>
        </DialogHeader>

        {/* 面包屑导航 */}
        <div className="flex items-center gap-1 py-2 border-b text-sm overflow-x-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 flex-shrink-0" 
            onClick={() => {
              setCurrentParentId(null);
              setBreadcrumbs([]);
              setSelectedId(null);
            }}
            title="返回根目录"
          >
            <Home className="h-4 w-4" />
          </Button>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.id} className="flex items-center gap-1 flex-shrink-0">
              <span className="text-muted-foreground">/</span>
              <button
                type="button"
                className={cn(
                  "text-xs px-1 py-0.5 rounded hover:bg-muted transition-colors truncate max-w-[120px]",
                  index === breadcrumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"
                )}
                onClick={() => {
                  // 点击某一级，跳转到该级目录
                  const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
                  setBreadcrumbs(newBreadcrumbs);
                  setCurrentParentId(crumb.id);
                  setSelectedId(null);
                }}
                title={crumb.name}
              >
                {crumb.name}
              </button>
            </div>
          ))}
          {breadcrumbs.length === 0 && (
            <span className="text-xs text-muted-foreground ml-1">根目录</span>
          )}
        </div>

        {/* 文件夹列表 */}
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {folderLoading ? (
            <div className="text-center text-muted-foreground py-4">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">空文件夹</div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {items.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors",
                    selectedId === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  onDoubleClick={() => handleEnter(item)}
                >
                  <Folder className="h-4 w-4 fill-current opacity-70" />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.id !== "__ROOT__" && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 hover:bg-background/20"
                      onClick={(e) => { e.stopPropagation(); handleEnter(item); }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 复制时的新名称输入 */}
        {mode === "copy" && (
          <div className="grid gap-2 py-2 border-t">
            <Label htmlFor="newName" className="text-xs">新名称（可选）</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={entry?.original_name}
              className="h-8 text-sm"
            />
          </div>
        )}

        {error && <div className="text-sm text-red-500 py-2">{error}</div>}

        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={() => { if (!loading) onOpenChange(false); }}
          leftButtonGlassVariant="ghost"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        >
          <div className="text-xs text-muted-foreground truncate flex-1">
            目标: {selectedName}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
