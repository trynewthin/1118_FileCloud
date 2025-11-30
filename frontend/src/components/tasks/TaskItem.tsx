import { Progress } from "@/components/ui/progress";
import type { TaskRecord } from "@/lib/api/tasks";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/common/GlassCard";

interface TaskItemProps {
  task: TaskRecord;
}

export function TaskItem({ task }: TaskItemProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case "SUCCESS":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "RUNNING":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (task.status) {
      case "SUCCESS": return "已完成";
      case "FAILED": return "失败";
      case "RUNNING": return "进行中";
      case "PENDING": return "等待中";
      default: return task.status;
    }
  };

  // 格式化详细进度显示
  const getDetailProgressText = () => {
    if (!task.detail_progress) return null;
    const { current, total, label } = task.detail_progress;
    
    if (total > 0) {
      return `${label || ""} ${current}/${total}`.trim();
    }
    if (current > 0) {
      return `${label || ""} ${current}`.trim();
    }
    return label || null;
  };

  const detailText = getDetailProgressText();

  return (
    <GlassCard variant="lite" className="p-4 border-white/10">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-full bg-muted/20">
          {getStatusIcon()}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-medium truncate">{formatTaskType(task.type)}</p>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(task.created_at).toLocaleString()}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{getStatusText()}</span>
            {task.status === "RUNNING" && <span>{task.progress}%</span>}
          </div>

          {/* 详细进度信息 */}
          {detailText && (
            <p className="text-xs text-muted-foreground/80">
              {detailText}
            </p>
          )}

          {task.status === "RUNNING" && (
            <div className="mt-2">
              <Progress value={task.progress} className="h-1.5" />
            </div>
          )}

          {task.error_message && (
             <p className="text-xs text-red-500 mt-1 break-all">
               {task.error_message}
             </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

function formatTaskType(type: string) {
  switch (type) {
    case "FILE_INDEX_LIBRARY": return "索引文件库";
    case "FILE_INDEX_SINGLE": return "索引指定路径";
    case "FILE_GENERATE_THUMBNAIL": return "生成缩略图";
    case "FILE_DELETE_ENTRY": return "删除文件";
    case "FILE_COPY_ENTRY": return "复制文件";
    case "FILE_MOVE_ENTRY": return "移动文件";
    case "FILE_RENAME_ENTRY": return "重命名文件";
    case "FILE_RESTORE_ENTRY": return "还原文件";
    case "FILE_DESTROY_ENTRY": return "彻底删除文件";
    default: return type;
  }
}
