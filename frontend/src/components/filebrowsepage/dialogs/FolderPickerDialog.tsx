import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Folder, ChevronRight, Home, XIcon, Check } from "lucide-react";
import { GlassIconButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/dialog/dialog";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string; // entryId or path
  name: string;
  path?: string;
  hasChildren?: boolean;
}

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "system" | "library";
  libraryId?: number; // library 模式下需要
  initialPath?: string; // system 模式下的初始路径
  initialParentId?: string | null; // library 模式下的初始父目录 ID
  onSubmit: (value: string) => void; // system -> path, library -> entryId
  title?: string;
  description?: string;
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  mode,
  libraryId,
  initialPath,
  initialParentId,
  onSubmit,
  title,
  description,
}: FolderPickerDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath || ""); // for system
  const [currentParentId, setCurrentParentId] = useState<string | null>(null); // for library
  const [items, setItems] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const systemBreadcrumbScrollRef = useRef<HTMLDivElement | null>(null);

  const systemBreadcrumbs = useMemo(() => {
    if (!currentPath) return [] as { label: string; path: string }[];
    const sep = currentPath.includes("\\") ? "\\" : "/";
    const rawParts = currentPath.split(sep).filter(Boolean);
    const parts: { label: string; path: string }[] = [];
    let acc = "";
    rawParts.forEach((part, index) => {
      if (index === 0) {
        acc = part;
      } else {
        acc = `${acc}${sep}${part}`;
      }
      parts.push({ label: part, path: acc });
    });
    return parts;
  }, [currentPath]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === "system") {
        const query = currentPath ? `?path=${encodeURIComponent(currentPath)}` : "";
        const res = await apiClient.get<{ items: any[], separator: string, currentPath: string }>(
          `/system/fs/list${query}`
        );
        setItems(res.items.filter((i: any) => i.is_directory).map((i: any) => ({
          id: i.path,
          name: i.name,
          path: i.path
        })));
        // System mode breadcrumbs handled simply by splitting path or just showing current
      } else {
        if (!libraryId) return;
        const query = currentParentId ? `?parentId=${encodeURIComponent(currentParentId)}` : "";
        const res = await apiClient.get<{ items: any[] }>(
          `/files/library/${libraryId}/entries${query}`
        );

        const dirs = res.items
          .filter((i: any) => i.is_directory)
          .map((i: any) => ({
            id: i.id,
            name: i.original_name,
          }));

        // 根目录下增加一个显式的“根目录”虚拟项，方便选择移动到根
        if (!currentParentId) {
          setItems([
            { id: "__ROOT__", name: "根目录（当前文件库）" },
            ...dirs,
          ]);
        } else {
          setItems(dirs);
        }
      }
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mode, currentPath, currentParentId, libraryId]);

  // 初始化：当对话框打开时，设置初始目录
  useEffect(() => {
    if (open && !initialized) {
      if (mode === "library" && initialParentId) {
        // 需要加载初始目录的祖先路径来构建面包屑
        loadInitialBreadcrumbs(initialParentId);
      } else {
        setCurrentParentId(null);
        setBreadcrumbs([]);
        load();
      }
      setSelectedId(null);
      setInitialized(true);
    }
    if (!open) {
      setInitialized(false);
    }
  }, [open, initialized, mode, initialParentId]);

  // 加载初始目录的祖先路径
  const loadInitialBreadcrumbs = async (parentId: string) => {
    if (!libraryId) return;
    try {
      // 获取祖先路径
      const res = await apiClient.get<{ entry: any; ancestors?: { id: string; name: string }[] }>(
        `/files/entries/${parentId}`
      );
      if (res.ancestors && res.ancestors.length > 0) {
        // ancestors 是从根到当前的路径，需要加上当前目录本身
        const crumbs = [...res.ancestors, { id: parentId, name: res.entry.original_name }];
        setBreadcrumbs(crumbs);
        setCurrentParentId(parentId);
      } else {
        // 当前目录就是根目录的直接子目录
        setBreadcrumbs([{ id: parentId, name: res.entry.original_name }]);
        setCurrentParentId(parentId);
      }
      load();
    } catch {
      // 加载失败，回退到根目录
      setCurrentParentId(null);
      setBreadcrumbs([]);
      load();
    }
  };

  useEffect(() => {
    const el = systemBreadcrumbScrollRef.current;
    if (!el) return;
    if (!currentPath) return;
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
  }, [systemBreadcrumbs.length, currentPath]);

  // 当 currentParentId 或 currentPath 变化时重新加载
  useEffect(() => {
    if (open && initialized) {
      load();
    }
  }, [currentParentId, currentPath]);

  const handleEnter = (item: FolderItem) => {
    if (mode === "system") {
      setCurrentPath(item.id);
      // System breadcrumbs logic is complex due to OS differences, simplified here
    } else {
      setCurrentParentId(item.id);
      setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    }
    setSelectedId(null);
  };

  const handleGoUp = () => {
    if (mode === "library") {
      if (breadcrumbs.length > 0) {
        const newBreadcrumbs = breadcrumbs.slice(0, -1);
        setBreadcrumbs(newBreadcrumbs);
        setCurrentParentId(newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : null);
      }
    } else {
      // System mode go up logic needed, or just rely on ".." if backend returned it
      // Simple hack: split by separator provided by backend? 
      // For now, maybe just a "Reset" button for system mode
      setCurrentPath(""); // Back to root/home
    }
  };

  const handleSubmit = () => {
    // If system mode, return current path (if selectedId is null, maybe current folder?)
    // If library mode, return selectedId (if null, return currentParentId?)
    
    if (mode === "system") {
      // 用户可能选中了子文件夹，也可能想选当前所在文件夹
      // 简单逻辑：如果选中了 item，返回 item.path；否则返回 currentPath
      onSubmit(selectedId || currentPath);
    } else {
      // library 模式：
      // - 若选中了虚拟项 "__ROOT__" 或未选中且在根目录，则表示根目录（传空字符串）。
      // - 否则优先返回选中的目录 ID，其次是当前目录 ID。
      const isRootSelected =
        selectedId === "__ROOT__" || (!selectedId && !currentParentId);

      if (isRootSelected) {
        onSubmit("");
      } else {
        onSubmit(selectedId || currentParentId || "");
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[500px] flex flex-col" showCloseButton={false}>
        <GlassCard variant="lite" className="p-4">
          <DialogHeader>
            <DialogTitle>{title || "选择文件夹"}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        </GlassCard>

        {mode === "system" ? (
          <GlassCard variant="lite" className="px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <GlassIconButton
              glassVariant="lite"
              className="h-6 w-6 shrink-0"
              onClick={() => {
                setCurrentPath("");
                setSelectedId(null);
              }}
            >
              <Home className="h-4 w-4" />
            </GlassIconButton>
            <div
              ref={systemBreadcrumbScrollRef}
              className="flex-1 min-w-0 overflow-x-auto scrollbar-thin pr-1"
            >
              <div className="flex items-center font-mono text-xs text-muted-foreground min-w-fit">
                {currentPath === "" && <span className="whitespace-nowrap">磁盘根目录</span>}
                {currentPath !== "" && systemBreadcrumbs.map((seg, index) => (
                  <div key={seg.path} className="flex items-center min-w-0">
                    {index > 0 && <span className="mx-1 opacity-60">/</span>}
                    <button
                      type="button"
                      className={cn(
                        "truncate max-w-[120px] md:max-w-[200px] text-left",
                        index === systemBreadcrumbs.length - 1 ? "text-foreground" : "hover:text-foreground"
                      )}
                      onClick={() => {
                        setCurrentPath(seg.path);
                        setSelectedId(null);
                      }}
                      title={seg.label}
                    >
                      {seg.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </GlassCard>
        ) : (
          <GlassCard variant="lite" className="px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <GlassIconButton
              glassVariant="lite"
              className="h-6 w-6"
              onClick={handleGoUp}
              disabled={mode === "library" && !currentParentId}
            >
              <Home className="h-4 w-4" />
            </GlassIconButton>
            <div className="flex-1 truncate font-mono text-xs text-muted-foreground">
              {breadcrumbs.length === 0 ? "根目录" : breadcrumbs.map(b => b.name).join(" / ")}
            </div>
          </div>
          </GlassCard>
        )}

        <GlassCard variant="lite" className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto py-2">
          {loading ? (
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
                  <GlassIconButton
                    glassVariant="lite"
                    className="h-6 w-6 hover:bg-background/20"
                    onClick={(e) => { e.stopPropagation(); handleEnter(item); }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </GlassIconButton>
                </div>
              ))}
            </div>
          )}
        </div>
        </GlassCard>

        <DialogFooter
          leftButtonIcon={<XIcon className="h-4 w-4" />}
          onLeftButtonClick={() => onOpenChange(false)}
          leftButtonGlassVariant="lite"
          rightButtonIcon={<Check className="h-4 w-4" />}
          onRightButtonClick={handleSubmit}
          rightButtonGlassVariant="lite"
        >
          <div className="text-xs text-muted-foreground truncate flex-1">
             {selectedId ? "已选择: " + (items.find(i => i.id === selectedId)?.name) : "选择当前目录"}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
