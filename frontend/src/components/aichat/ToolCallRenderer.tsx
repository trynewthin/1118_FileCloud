import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Search,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/common/GlassButton";
import { buildApiUrl } from "@/lib/api/client";
import {
  THUMBNAIL_EXTS,
  getFileIconGroup,
  FILE_ICON_COMPONENTS,
  FILE_ICON_DEFAULT_COMPONENT,
} from "@/configs/fileTypeIcons";

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

// 搜索结果渲染
function SearchResultsRenderer({ result }: { result: ToolCallResult }) {
  const results = result.results || [];
  const [expanded, setExpanded] = useState(results.length <= 10);
  
  const displayResults = expanded ? results : results.slice(0, 5);
  const hasMore = results.length > 5 && !expanded;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Search className="h-3.5 w-3.5" />
        <span>{result.message}</span>
      </div>
      {results.length === 0 ? (
        <div className="text-sm text-muted-foreground py-2">未找到匹配的文件或目录</div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {displayResults.map((item: { id: string; name: string; path: string; isDirectory: boolean; size: number; extension: string | null }) => (
            <div 
              key={item.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group"
            >
              {item.isDirectory ? (
                <Folder className="h-4 w-4 text-primary shrink-0" />
              ) : (() => {
                const group = getFileIconGroup(item.extension || "");
                const Icon = group ? FILE_ICON_COMPONENTS[group] : FILE_ICON_DEFAULT_COMPONENT;
                return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
              })()}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{item.name}</div>
                <div className="text-xs text-muted-foreground truncate">{item.path}</div>
              </div>
              {!item.isDirectory && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(item.size)}
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
              显示全部 {results.length} 项
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 文件展示渲染（支持点击跳转）
function FileDisplayRenderer({ result }: { result: ToolCallResult }) {
  const navigate = useNavigate();
  const files = result.files || [];
  const title = result.title || "文件";
  
  const token = typeof window !== "undefined"
    ? window.localStorage.getItem("filecloud_auth_token")
    : null;
  
  // 点击文件跳转
  const handleClick = (file: {
    id: string;
    name: string;
    isDirectory: boolean;
    libraryId: number;
  }) => {
    if (file.isDirectory) {
      // 目录：跳转到文件浏览页面
      navigate(`/files?libraryId=${file.libraryId}&parentId=${file.id}`);
    } else {
      // 文件：跳转到预览页面
      navigate(`/preview/${file.id}`);
    }
  };
  
  // 获取缩略图 URL
  const getThumbnailUrl = (file: { id: string; extension: string | null }) => {
    const ext = file.extension?.toLowerCase() || "";
    if (!THUMBNAIL_EXTS.has(ext)) return null;
    return buildApiUrl(
      token
        ? `/file-content/${file.id}/thumbnail?token=${encodeURIComponent(token)}`
        : `/file-content/${file.id}/thumbnail`
    );
  };
  
  // 获取文件图标（统一使用 fileTypeIcons 配置）
  const getFileIcon = (file: { isDirectory: boolean; extension: string | null; mimeType: string | null }) => {
    if (file.isDirectory) {
      return <Folder className="h-5 w-5 text-amber-500" />;
    }
    const ext = file.extension?.toLowerCase() || "";
    const group = getFileIconGroup(ext);
    const Icon = group ? FILE_ICON_COMPONENTS[group] : FILE_ICON_DEFAULT_COMPONENT;
    return <Icon className="h-5 w-5 text-blue-500" />;
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <ExternalLink className="h-3.5 w-3.5" />
        <span>{title}</span>
        <span className="text-muted-foreground/60">(点击跳转)</span>
      </div>
      <div className="space-y-1.5">
        {files.map((file: {
          id: string;
          name: string;
          isDirectory: boolean;
          size: number;
          extension: string | null;
          mimeType: string | null;
          libraryId: number;
        }) => {
          const thumbnailUrl = getThumbnailUrl(file);
          
          return (
            <div
              key={file.id}
              onClick={() => handleClick(file)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors group border border-transparent hover:border-primary/20"
            >
              {/* 缩略图或图标 */}
              <div className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-muted/50 flex items-center justify-center">
                {thumbnailUrl && !file.isDirectory ? (
                  <img
                    src={thumbnailUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 缩略图加载失败时隐藏
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  getFileIcon(file)
                )}
              </div>
              
              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {file.isDirectory ? "文件夹" : formatSize(file.size)}
                </div>
              </div>
              
              {/* 跳转指示 */}
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </div>
          );
        })}
      </div>
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
      case "search_results":
        return <SearchResultsRenderer result={result} />;
      case "file_display":
        return <FileDisplayRenderer result={result} />;
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
    <div className="py-1">
      {renderContent()}
    </div>
  );
}
