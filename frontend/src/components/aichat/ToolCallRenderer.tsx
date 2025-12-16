import type { PendingAction, ToolCallResult } from "./tool/types";
import { LibraryListRenderer } from "./tool/LibraryListRenderer";
import { DirectoryListingRenderer } from "./tool/DirectoryListingRenderer";
import { FileInfoRenderer } from "./tool/FileInfoRenderer";
import { SearchResultsRenderer } from "./tool/SearchResultsRenderer";
import { FileDisplayRenderer } from "./tool/FileDisplayRenderer";
import { TimeInfoRenderer } from "./tool/TimeInfoRenderer";
import { MarkdownFileRenderer } from "./tool/MarkdownFileRenderer";
import { HtmlFileRenderer } from "./tool/HtmlFileRenderer";
import { PendingActionRenderer } from "./tool/PendingActionRenderer";

export type { ToolCallResult, PendingAction };

interface ToolCallRendererProps {
  result: ToolCallResult;
  pendingAction?: PendingAction;
  onConfirm?: (action: PendingAction) => void;
  onCancel?: (action: PendingAction) => void;
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
      case "markdown_file":
        return <MarkdownFileRenderer result={result} />;
      case "html_file":
        return <HtmlFileRenderer result={result} />;
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
