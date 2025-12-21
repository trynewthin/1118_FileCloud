import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useFileLibraries } from "@/hooks/useFileLibraries";
import { useRemoteClients } from "@/hooks/useRemoteClients";
import { GlassButton } from "@/components/common/button/GlassButton";
import { GlassCard } from "@/components/common/GlassCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/common/dialog/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/common/dialog/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Folder, XIcon, Check, AlertTriangle, Server, Loader2 } from "lucide-react";
import { FolderPickerDialog } from "@/components/filebrowsepage";
import { getRemoteLibraries } from "@/lib/api/remoteProxy";
import { cn } from "@/lib/utils";

interface NewLibraryDialogProps {
  onSuccess?: () => void;
  // 受控模式：外部控制对话框开关
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // 是否显示触发按钮（默认显示）
  showTrigger?: boolean;
}

/**
 * 检查路径是否为盘符根目录
 * 匹配 C:\、D:\ 等格式
 */
const isDriveRoot = (path: string): boolean => {
  // Windows 盘符根目录：C:\、D:\ 等
  return /^[A-Za-z]:\\?$/.test(path.trim());
};

// 文件库类型
type LibraryType = "local" | "remote";

export function NewLibraryDialog({
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
}: NewLibraryDialogProps) {
  // 内部状态（非受控模式）
  const [internalOpen, setInternalOpen] = useState(false);

  // 判断是否为受控模式
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (value: boolean) => controlledOnOpenChange?.(value)
    : setInternalOpen;

  // 文件库类型选择
  const [libraryType, setLibraryType] = useState<LibraryType>("local");
  
  // 本地文件库状态
  const [rootPath, setRootPath] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { create, loading } = useFileLibraries({ autoRefresh: false });
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  // 远程文件库状态
  const { clients: remoteClients, loading: clientsLoading } = useRemoteClients();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [remoteLibraries, setRemoteLibraries] = useState<any[]>([]);
  const [selectedRemoteLibrary, setSelectedRemoteLibrary] = useState<any | null>(null);
  const [loadingRemoteLibs, setLoadingRemoteLibs] = useState(false);
  
  // 加载远程客户端的文件库列表
  useEffect(() => {
    if (selectedClientId) {
      setLoadingRemoteLibs(true);
      setSelectedRemoteLibrary(null);
      getRemoteLibraries(selectedClientId)
        .then((res) => {
          setRemoteLibraries(res.items || []);
        })
        .catch(() => {
          setRemoteLibraries([]);
        })
        .finally(() => {
          setLoadingRemoteLibs(false);
        });
    } else {
      setRemoteLibraries([]);
    }
  }, [selectedClientId]);
  
  // 重置状态
  const resetState = () => {
    setLibraryType("local");
    setRootPath("");
    setDisplayName("");
    setError("");
    setSelectedClientId(null);
    setSelectedRemoteLibrary(null);
    setRemoteLibraries([]);
  };

  const handleSubmit = async (e: React.FormEvent | null) => {
    if (e) {
      e.preventDefault();
    }
    
    if (libraryType === "local") {
      if (!rootPath) {
        setError("请选择文件库根路径");
        return;
      }
      setError("");
      try {
        await create({ rootPath, displayName: displayName || undefined });
        setOpen(false);
        resetState();
        toast.success("文件库创建成功，正在后台建立索引");
        onSuccess?.();
      } catch (err: any) {
        setError(err?.message || "创建失败");
      }
    } else {
      // 远程文件库：目前只是导航到远程浏览页面
      if (!selectedClientId || !selectedRemoteLibrary) {
        setError("请选择远程客户端和文件库");
        return;
      }
      // 远程文件库暂不支持直接添加，跳转到浏览页面
      setOpen(false);
      resetState();
      toast.info("远程文件库已添加到浏览列表");
      onSuccess?.();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <GlassButton className="gap-2" glassVariant="lite">
              <Plus className="h-4 w-4" />
              新建文件库
            </GlassButton>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-[450px]" showCloseButton={false}>
          <form onSubmit={(e) => handleSubmit(e)}>
            <GlassCard variant="lite" className="p-4">
              <DialogHeader>
                <DialogTitle>新建文件库</DialogTitle>
                <DialogDescription>
                  {libraryType === "local" 
                    ? "添加一个新的本地目录作为文件库。" 
                    : "连接远程客户端的文件库。"}
                </DialogDescription>
              </DialogHeader>
            </GlassCard>

            <div className="grid gap-3 py-3">
              {/* 类型选择 */}
              <GlassCard variant="lite" className="p-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLibraryType("local")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                      libraryType === "local"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background/50 hover:bg-accent/50"
                    )}
                  >
                    <Folder className="h-4 w-4" />
                    <span className="text-sm font-medium">本地文件库</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibraryType("remote")}
                    disabled={remoteClients.length === 0}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                      libraryType === "remote"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-background/50 hover:bg-accent/50",
                      remoteClients.length === 0 && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Server className="h-4 w-4" />
                    <span className="text-sm font-medium">远程文件库</span>
                    {remoteClients.length > 0 && (
                      <span className="text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                        {remoteClients.length}
                      </span>
                    )}
                  </button>
                </div>
              </GlassCard>
              
              {/* 本地文件库表单 */}
              {libraryType === "local" && (
              <GlassCard variant="lite" className="p-4 grid gap-5">
                <div className="grid gap-2">
                  <Label>
                    根路径 <span className="text-destructive">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-input bg-background/50 hover:bg-accent/50 transition-colors text-left"
                  >
                    <Folder className="h-5 w-5 text-muted-foreground shrink-0" />
                    {rootPath ? (
                      <span className="text-sm font-mono truncate">{rootPath}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">点击选择服务器目录...</span>
                    )}
                  </button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="displayName">显示名称</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="可选，默认使用目录名"
                    className="bg-background/50 border-white/10 focus:bg-background/80"
                  />
                </div>
              </GlassCard>
              )}
              
              {/* 远程文件库表单 */}
              {libraryType === "remote" && (
              <GlassCard variant="lite" className="p-4 grid gap-4">
                <div className="grid gap-2">
                  <Label>选择远程客户端</Label>
                  {clientsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      加载中...
                    </div>
                  ) : remoteClients.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-2">
                      暂无在线的远程客户端
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {remoteClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left",
                            selectedClientId === client.id
                              ? "border-primary bg-primary/10"
                              : "border-input bg-background/50 hover:bg-accent/50"
                          )}
                        >
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{client.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedClientId && (
                <div className="grid gap-2">
                  <Label>选择文件库</Label>
                  {loadingRemoteLibs ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      加载文件库列表...
                    </div>
                  ) : remoteLibraries.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-2">
                      该客户端暂无文件库
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {remoteLibraries.map((lib) => (
                        <button
                          key={lib.id}
                          type="button"
                          onClick={() => setSelectedRemoteLibrary(lib)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left",
                            selectedRemoteLibrary?.id === lib.id
                              ? "border-primary bg-primary/10"
                              : "border-input bg-background/50 hover:bg-accent/50"
                          )}
                        >
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate">{lib.display_name || lib.root_path}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </GlassCard>
              )}

              {error && (
                <GlassCard variant="lite" className="p-3">
                  <div className="text-sm text-red-500">{error}</div>
                </GlassCard>
              )}
            </div>
            <DialogFooter
              leftButtonIcon={<XIcon className="h-4 w-4" />}
              onLeftButtonClick={() => {
                if (!loading) setOpen(false);
              }}
              leftButtonGlassVariant="lite"
              rightButtonIcon={<Check className="h-4 w-4" />}
              onRightButtonClick={() => {
                if (!loading) handleSubmit(null);
              }}
              rightButtonGlassVariant="lite"
            ></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FolderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="system"
        initialPath={rootPath}
        onSubmit={(val) => {
          // 检查是否为盘符根目录，需要二次确认
          if (isDriveRoot(val)) {
            setPendingPath(val);
            setConfirmOpen(true);
          } else {
            setRootPath(val);
          }
        }}
        title="选择服务器目录"
        description="请选择服务器上的真实目录作为文件库根路径。"
      />

      {/* 盘符根目录二次确认对话框 */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              确认选择根目录？
            </AlertDialogTitle>
            <AlertDialogDescription>
              您选择的是盘符根目录 <span className="font-mono font-semibold">{pendingPath}</span>，
              这将索引整个磁盘的所有文件，可能包含系统文件和大量数据。
              <br />
              <br />
              建议选择一个具体的子目录作为文件库根路径。确定要继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPath(null)}>
              <span className="sr-only">取消</span>
              <XIcon className="h-4 w-4" />
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingPath) {
                  setRootPath(pendingPath);
                  setPendingPath(null);
                }
              }}
            >
              <span className="sr-only">确认</span>
              <Check className="h-4 w-4" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
