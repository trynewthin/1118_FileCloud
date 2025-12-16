import { Folder, File } from "lucide-react";
import type { ToolCallResult } from "./types";
import { formatSize } from "./format";

export function FileInfoRenderer({ result }: { result: ToolCallResult }) {
  const file = result.file;
  if (!file) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {file.isDirectory ? (
          <Folder className="h-5 w-5 text-primary" />
        ) : (
          <File className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="font-medium">{file.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {!file.isDirectory && (
          <>
            <div>大小: {formatSize(file.size)}</div>
            <div>类型: {file.mimeType || file.extension || "未知"}</div>
          </>
        )}
        <div>创建: {new Date(file.createdAt).toLocaleString("zh-CN")}</div>
        <div>修改: {new Date(file.updatedAt).toLocaleString("zh-CN")}</div>
      </div>
    </div>
  );
}
