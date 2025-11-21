import { HardDrive, RefreshCw, Trash2 } from "lucide-react";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LibraryCardProps {
  library: FileLibrary;
  onRefresh: (id: number) => void;
  onDelete: (id: number) => void;
  loading?: boolean;
}

export function LibraryCard({ library, onRefresh, onDelete, loading }: LibraryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">{library.display_name || "未命名文件库"}</CardTitle>
          </div>
          <Badge variant={library.is_enabled ? "default" : "secondary"}>
            {library.is_enabled ? "已启用" : "已禁用"}
          </Badge>
        </div>
        <CardDescription className="font-mono text-xs truncate" title={library.root_path}>
          {library.root_path}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">已用空间</span>
            <span>{library.current_size_bytes ? (library.current_size_bytes / 1024 / 1024).toFixed(2) + " MB" : "0 B"}</span>
          </div>
          <div className="flex justify-between">
             <span className="text-muted-foreground">最后扫描</span>
             <span>{library.last_scanned_at ? new Date(library.last_scanned_at).toLocaleString() : "从未"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefresh(library.id)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(library.id)}
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          删除
        </Button>
      </CardFooter>
    </Card>
  );
}
