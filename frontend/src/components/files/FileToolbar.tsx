import { Grid, List, RefreshCw, Upload, FolderPlus, Trash2, RotateCw, CheckSquare, X, Move, Copy, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import { cn } from "@/lib/utils";
import { DS } from "@/lib/design-system";

interface FileToolbarProps {
  libraries: FileLibrary[];
  currentLibraryId: number | null;
  onLibraryChange: (id: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onRefresh: () => void;
  onReindex?: () => void;
  onOpenTrash?: () => void;
  onUpload?: () => void;
  onCreateFolder?: () => void;
  // 批量模式相关
  batchMode?: boolean;
  onBatchModeChange?: (enabled: boolean) => void;
  selectedCount?: number;
  onBatchMove?: () => void;
  onBatchCopy?: () => void;
  onBatchDelete?: () => void;
}

export function FileToolbar({
  libraries,
  currentLibraryId,
  onLibraryChange,
  viewMode,
  onViewModeChange,
  onRefresh,
  onReindex,
  onOpenTrash,
  onUpload,
  onCreateFolder,
  batchMode = false,
  onBatchModeChange,
  selectedCount = 0,
  onBatchMove,
  onBatchCopy,
  onBatchDelete,
}: FileToolbarProps) {
  // 批量模式下显示批量操作栏
  if (batchMode) {
    return (
      <GlassCard className="p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onBatchModeChange?.(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1.5" />
            取消
          </Button>
          <span className="text-sm text-muted-foreground">
            已选择 <span className="font-medium text-foreground">{selectedCount}</span> 项
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onBatchMove}
            className="bg-background/50 border-transparent shadow-sm"
          >
            <Move className="h-4 w-4 mr-1.5" />
            移动
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onBatchCopy}
            className="bg-background/50 border-transparent shadow-sm"
          >
            <Copy className="h-4 w-4 mr-1.5" />
            复制
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0}
            onClick={onBatchDelete}
            className="bg-background/50 border-transparent shadow-sm text-destructive hover:text-destructive"
          >
            <Trash className="h-4 w-4 mr-1.5" />
            删除
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Left Section: Library Select & Basic Actions */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Select
          value={currentLibraryId?.toString() ?? ""}
          onValueChange={onLibraryChange}
        >
          <SelectTrigger className="w-[180px] h-9 bg-background/50 border-transparent shadow-sm focus:ring-1">
            <SelectValue placeholder="选择文件库" />
          </SelectTrigger>
          <SelectContent>
            {libraries.map((lib) => (
              <SelectItem key={lib.id} value={lib.id.toString()}>
                {lib.display_name || lib.root_path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="h-6 w-px bg-border/50 mx-1" />

        <Button variant="ghost" size="icon-sm" onClick={onRefresh} title="刷新" className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
        </Button>

        {onReindex && (
          <Button variant="ghost" size="icon-sm" onClick={onReindex} title="重建索引" className="text-muted-foreground hover:text-foreground">
            <RotateCw className="h-4 w-4" />
          </Button>
        )}

        {onBatchModeChange && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onBatchModeChange(true)}
            title="批量选择"
            className="text-muted-foreground hover:text-foreground"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Right Section: Operations & View Toggle */}
      <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end min-w-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!onCreateFolder}
            onClick={onCreateFolder}
            className="bg-background/50 border-transparent shadow-sm"
          >
            <FolderPlus className="h-4 w-4 mr-1.5" />
            新建
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!onUpload}
            onClick={onUpload}
            className="shadow-md"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            上传
          </Button>
        </div>
        
        <div className="h-6 w-px bg-border/50 mx-2" />

        {onOpenTrash && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive transition-colors"
            onClick={onOpenTrash}
            title="回收站"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        <div className={cn("flex items-center p-1 gap-1", DS.radius.md, "bg-muted/50")}>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            className={cn("h-7 w-7 shadow-none", viewMode === "grid" && "bg-background shadow-sm")}
            onClick={() => onViewModeChange("grid")}
          >
            <Grid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            className={cn("h-7 w-7 shadow-none", viewMode === "list" && "bg-background shadow-sm")}
            onClick={() => onViewModeChange("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
