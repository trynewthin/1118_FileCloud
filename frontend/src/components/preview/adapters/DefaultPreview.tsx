import type { FileEntry } from "@/lib/api/files";
import { Button } from "@/components/ui/button";
import { Download, File } from "lucide-react";

interface DefaultPreviewProps {
  entry: FileEntry;
}

export function DefaultPreview({ entry }: DefaultPreviewProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-8 text-center">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
        <File className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">{entry.original_name}</h2>
      <p className="text-muted-foreground mb-8">
        暂不支持预览此文件类型 ({entry.mime_type || "未知类型"})
      </p>
      
      {/* 
        这里其实可以加一个下载按钮，但因为下载逻辑在 page 层有封装，
        或者需要鉴权，这里先留个 UI 占位
      */}
      <Button variant="outline" className="gap-2">
        <Download className="w-4 h-4" />
        下载文件
      </Button>
    </div>
  );
}
