import { Grid, List, RefreshCw, Upload, FolderPlus } from "lucide-react";
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
}

export function FileToolbar({
  libraries,
  currentLibraryId,
  onLibraryChange,
  viewMode,
  onViewModeChange,
  onRefresh,
}: FileToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-2 rounded-lg border">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Select
          value={currentLibraryId?.toString() ?? ""}
          onValueChange={onLibraryChange}
        >
          <SelectTrigger className="w-[200px]">
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
        
        <div className="h-6 w-px bg-border mx-2" />

        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled>
          <FolderPlus className="h-4 w-4 mr-2" />
          新建文件夹
        </Button>
        <Button variant="default" size="sm" disabled>
          <Upload className="h-4 w-4 mr-2" />
          上传
        </Button>
        
        <div className="h-6 w-px bg-border mx-2" />

        <div className="flex items-center rounded-md border bg-background p-1">
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
