import { Progress } from "@/components/ui/progress";
import type { TaskRecord } from "@/lib/api/tasks";
import { deleteTask } from "@/lib/api/tasks";
import { CheckCircle2, XCircle, Clock, Loader2, Trash2, Square } from "lucide-react";
import { GlassCard } from "@/components/common/GlassCard";
import { GlassButton } from "@/components/common/button/GlassButton";

interface TaskItemProps {
  task: TaskRecord;
  onDeleted?: () => void; // 删除后的回调，用于刷新列表
}

export function TaskItem({ task, onDeleted }: TaskItemProps) {
  // 处理删除/取消任务
  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
      onDeleted?.();
    } catch (err) {
      console.error("删除任务失败", err);
    }
  };

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

          {/* 详细进度信息（仅运行中任务显示） */}
          {task.status === "RUNNING" && detailText && (
            <p className="text-xs text-muted-foreground/80">
              {detailText}
            </p>
          )}

          {/* 进度条（仅运行中任务显示） */}
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

        {/* 删除/取消按钮 */}
        <GlassButton
          glassVariant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          title={task.status === "RUNNING" ? "取消任务" : "删除任务"}
        >
          {task.status === "RUNNING" ? (
            <Square className="h-4 w-4" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </GlassButton>
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
