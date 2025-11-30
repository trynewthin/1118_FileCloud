import type { FileEntry } from "@/lib/api/files";
import { File } from "lucide-react";

interface DefaultPreviewProps {
  entry: FileEntry;
}

export function DefaultPreview({ entry }: DefaultPreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8 text-center min-h-[300px]">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
        <File className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">{entry.original_name}</h2>
      <p className="text-muted-foreground">
        暂不支持预览此文件类型 ({entry.mime_type || "未知类型"})
      </p>
    </div>
  );
}
