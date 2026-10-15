import { useState, useEffect, useMemo, useRef } from "react";
import { Folder, ChevronRight, Home, XIcon, Check, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export function FolderPickerDialog(props: FolderPickerDialogProps) {
  return <FolderPickerDialogContent key={`${props.open}-${props.mode}-${props.libraryId}-${props.initialParentId}-${props.initialPath}`} {...props} />;
}

function FolderPickerDialogContent({
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
  const [currentParentId, setCurrentParentId] = useState<string | null>(initialParentId ?? null); // for library
  const [items, setItems] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const systemBreadcrumbScrollRef = useRef<HTMLDivElement | null>(null);

  // 密钥验证状态（仅 system 模式）
  const [requireKey, setRequireKey] = useState<boolean | null>(null); // null = 还未检查
  const [fsAccessKey, setFsAccessKey] = useState("");
  const [keyVerified, setKeyVerified] = useState(false);
  const [keyError, setKeyError] = useState("");

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

  useEffect(() => {
    if (!open || mode !== "system") return;
    let active = true;
    apiClient.get<{ required: boolean }>("/system/fs/require-key").then(res => {
      if (!active) return;
      setRequireKey(res.required);
      setKeyVerified(!res.required);
    }).catch(() => {
      if (!active) return;
      setRequireKey(false);
      setKeyVerified(true);
    });
    return () => { active = false; };
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "library" || !currentParentId || !libraryId) return;
    let active = true;
    apiClient.get<{ entry: { original_name: string }; ancestors?: { id: string; name: string }[] }>(
      `/files/entries/${currentParentId}`
    ).then(res => {
      if (active) setBreadcrumbs([...(res.ancestors ?? []), { id: currentParentId, name: res.entry.original_name }]);
    }).catch(() => {
      if (!active) return;
      setCurrentParentId(null);
      setBreadcrumbs([]);
    });
    return () => { active = false; };
  }, [open, mode, currentParentId, libraryId]);

  useEffect(() => {
    if (!open || (mode === "system" && !keyVerified)) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        if (mode === "system") {
          const query = currentPath ? `?path=${encodeURIComponent(currentPath)}` : "";
          const headers: Record<string, string> = {};
          if (fsAccessKey) {
            headers["x-fs-access-key"] = fsAccessKey;
          }
          const res = await apiClient.get<{ items: { path: string; name: string; is_directory: boolean }[], separator: string, currentPath: string }>(
            `/system/fs/list${query}`,
            { headers }
          );
          if (!active) return;
          setItems(res.items.filter((i) => i.is_directory).map((i) => ({
            id: i.path,
            name: i.name,
            path: i.path
          })));
          setKeyError("");
          // System mode breadcrumbs handled simply by splitting path or just showing current
        } else {
          if (!libraryId) return;
          const query = currentParentId ? `?parentId=${encodeURIComponent(currentParentId)}` : "";
          const res = await apiClient.get<{ items: { id: string; original_name: string; is_directory: boolean }[] }>(
            `/files/library/${libraryId}/entries${query}`
          );

          if (!active) return;
          const dirs = res.items
            .filter((i) => i.is_directory)
            .map((i) => ({
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
      } catch (err: unknown) {
        if (!active) return;
        console.error(err);
        if ((err instanceof Error ? err.message : "")?.includes("密钥")) {
          setKeyError((err instanceof Error ? err.message : ""));
          setKeyVerified(false);
        }
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [open, keyVerified, mode, currentPath, currentParentId, libraryId, fsAccessKey]);

  useEffect(() => {
    const el = systemBreadcrumbScrollRef.current;
    if (!el) return;
    if (!currentPath) return;
    const frame = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(frame);
  }, [systemBreadcrumbs.length, currentPath]);

  // 密钥验证提交
  const handleKeySubmit = () => {
    if (!fsAccessKey.trim()) {
      setKeyError("请输入访问密钥");
      return;
    }
    setKeyVerified(true);
  };

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

        {/* System 模式密钥验证 */}
        {mode === "system" && requireKey === true && !keyVerified && (
          <GlassCard variant="lite" className="flex-1 p-6">
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Lock className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <div className="font-medium">访问服务器目录需要密钥</div>
                <div className="text-sm text-muted-foreground mt-1">请输入管理员提供的访问密钥</div>
              </div>
              <div className="w-full max-w-[280px] space-y-3">
                <Input
                  type="password"
                  placeholder="输入访问密钥"
                  value={fsAccessKey}
                  onChange={(e) => setFsAccessKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleKeySubmit()}
                />
                {keyError && <div className="text-sm text-destructive">{keyError}</div>}
                <Button className="w-full" onClick={handleKeySubmit}>
                  验证
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        {/* System 模式正常显示 */}
        {mode === "system" && (requireKey === false || keyVerified) && (
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
        )}

        {/* Library 模式 */}
        {mode === "library" && (
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

        {/* 目录列表（仅在验证通过或不需要验证时显示） */}
        {(mode === "library" || requireKey === false || keyVerified) && (
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
        )}

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
