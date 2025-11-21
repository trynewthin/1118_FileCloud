import { Grid, List, RefreshCw, Upload, FolderPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FileLibrary } from "@/lib/api/fileLibraries";

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
}: FileToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-2 rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <Select
          value={currentLibraryId?.toString() ?? ""}
          onValueChange={onLibraryChange}
        >
          <SelectTrigger className="w-[140px] sm:w-[200px]">
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
        
        <div className="h-6 w-px bg-border mx-1 sm:mx-2" />

        <Button variant="ghost" size="sm" onClick={onRefresh} className="px-2 sm:px-4">
          <RefreshCw className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">刷新</span>
        </Button>

        {onReindex && (
          <Button variant="ghost" size="sm" onClick={onReindex} className="text-muted-foreground hover:text-foreground px-2 sm:px-4">
            <span className="hidden sm:inline">重建索引</span>
            <span className="sm:hidden">重建</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 justify-between sm:justify-end">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled className="px-2 sm:px-4">
            <FolderPlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">新建</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            className="px-2 sm:px-4"
            disabled={!onUpload}
            onClick={onUpload}
          >
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">上传</span>
          </Button>
        </div>
        
        <div className="h-6 w-px bg-border mx-2 hidden sm:block" />

        {onOpenTrash && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2 sm:px-3 text-muted-foreground hover:text-foreground"
            onClick={onOpenTrash}
          >
            <Trash2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">回收站</span>
          </Button>
        )}

        <div className="flex items-center rounded-md border bg-background p-1 ml-auto sm:ml-0">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-6 w-6"
            onClick={() => onViewModeChange("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-6 w-6"
            onClick={() => onViewModeChange("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
