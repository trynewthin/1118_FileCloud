import { useState } from "react";
import { 
  Folder, 
  File, 
  FolderOpen, 
  Clock, 
  Check, 
  X, 
  AlertTriangle,
  Pencil,
  Move,
  Trash2,
  Database,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/GlassButton";

// 工具调用结果类型
export interface ToolCallResult {
  type: string;
  [key: string]: any;
}

// 待确认操作
export interface PendingAction {
  toolName: string;
  description: string;
  args: Record<string, any>;
}

interface ToolCallRendererProps {
  result: ToolCallResult;
  pendingAction?: PendingAction;
  onConfirm?: (action: PendingAction) => void;
  onCancel?: (action: PendingAction) => void;
}

// 格式化文件大小
const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// 文件库列表渲染
function LibraryListRenderer({ result }: { result: ToolCallResult }) {
  const libraries = result.libraries || [];
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Database className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>
      <div className="space-y-1">
        {libraries.map((lib: { id: number; name: string }) => (
          <div 
            key={lib.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm">{lib.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">ID: {lib.id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 目录列表渲染
function DirectoryListingRenderer({ result }: { result: ToolCallResult }) {
  const entries = result.entries || [];
  const [expanded, setExpanded] = useState(entries.length <= 10);
  
  const displayEntries = expanded ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5 && !expanded;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <FolderOpen className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {displayEntries.map((entry: { id: string; name: string; isDirectory: boolean; size: number; extension: string | null }) => (
          <div 
            key={entry.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group"
          >
            {entry.isDirectory ? (
              <Folder className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <File className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm truncate flex-1">{entry.name}</span>
            {!entry.isDirectory && (
              <span className="text-xs text-muted-foreground shrink-0">
                {formatSize(entry.size)}
              </span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        ))}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full text-center text-xs text-primary hover:underline py-1"
          >
            显示全部 {entries.length} 项
          </button>
        )}
      </div>
    </div>
  );
}

// 文件信息渲染
function FileInfoRenderer({ result }: { result: ToolCallResult }) {
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

// 时间信息渲染
function TimeInfoRenderer({ result }: { result: ToolCallResult }) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-primary" />
      <span className="text-sm">
        {result.date} {result.time}
      </span>
    </div>
  );
}

// 待确认操作渲染
function PendingActionRenderer({ 
  result, 
  pendingAction,
  onConfirm,
  onCancel,
}: { 
  result: ToolCallResult;
  pendingAction: PendingAction;
  onConfirm?: (action: PendingAction) => void;
  onCancel?: (action: PendingAction) => void;
}) {
  const [status, setStatus] = useState<"pending" | "confirmed" | "cancelled">("pending");
  
  const actionIcons: Record<string, React.ReactNode> = {
    rename: <Pencil className="h-4 w-4" />,
    move: <Move className="h-4 w-4" />,
    delete: <Trash2 className="h-4 w-4" />,
  };
  
  const actionColors: Record<string, string> = {
    rename: "text-primary",
    move: "text-info",
    delete: "text-destructive",
  };
  
  const action = result.action || "unknown";
  const icon = actionIcons[action] || <AlertTriangle className="h-4 w-4" />;
  const colorClass = actionColors[action] || "text-warning";
  
  const handleConfirm = () => {
    setStatus("confirmed");
    onConfirm?.(pendingAction);
  };
  
  const handleCancel = () => {
    setStatus("cancelled");
    onCancel?.(pendingAction);
  };
  
  if (status === "confirmed") {
    return (
      <div className="flex items-center gap-2 text-success">
        <Check className="h-4 w-4" />
        <span className="text-sm">操作已确认，正在执行...</span>
      </div>
    );
  }
  
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="text-sm">操作已取消</span>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-2", colorClass)}>
        {icon}
        <span className="text-sm font-medium">{pendingAction.description}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <GlassButton
          size="sm"
          glassVariant="lite"
          onClick={handleConfirm}
          className="h-8 px-3 text-xs"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          确认执行
        </GlassButton>
        <GlassButton
          size="sm"
          glassVariant="ghost"
          onClick={handleCancel}
          className="h-8 px-3 text-xs"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          取消
        </GlassButton>
      </div>
    </div>
  );
}

// 主渲染组件
export function ToolCallRenderer({ 
  result, 
  pendingAction,
  onConfirm,
  onCancel,
}: ToolCallRendererProps) {
  // 根据结果类型选择渲染器
  const renderContent = () => {
    switch (result.type) {
      case "library_list":
        return <LibraryListRenderer result={result} />;
      case "directory_listing":
        return <DirectoryListingRenderer result={result} />;
      case "file_info":
        return <FileInfoRenderer result={result} />;
      case "time_info":
        return <TimeInfoRenderer result={result} />;
      case "pending_action":
        if (pendingAction) {
          return (
            <PendingActionRenderer 
              result={result} 
              pendingAction={pendingAction}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          );
        }
        return <div className="text-sm text-muted-foreground">{result.message}</div>;
      default:
        // 默认渲染 JSON
        return (
          <pre className="text-xs bg-muted/30 p-2 rounded-md overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        );
    }
  };
  
  return (
    <GlassCard variant="ghost" className="p-3 my-2">
      {renderContent()}
    </GlassCard>
  );
}
