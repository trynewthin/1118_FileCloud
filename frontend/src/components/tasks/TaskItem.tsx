import { AnimatedCircularProgressBar } from "@/components/ui/animated-circular-progress-bar";
import type { TaskRecord } from "@/lib/api/tasks";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

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

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-muted/20">
          {getStatusIcon()}
        </div>
        <div>
          <p className="font-medium">{formatTaskType(task.type)}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{getStatusText()}</span>
            <span>•</span>
            <span>{new Date(task.created_at).toLocaleString()}</span>
          </div>
          {task.error_message && (
             <p className="text-xs text-red-500 mt-1 max-w-[300px] truncate" title={task.error_message}>
               {task.error_message}
             </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {task.status === "RUNNING" && (
          <div className="h-12 w-12">
             <AnimatedCircularProgressBar
                max={100}
                min={0}
                value={task.progress || 0}
                gaugePrimaryColor="rgb(59 130 246)"
                gaugeSecondaryColor="rgba(0, 0, 0, 0.1)"
             />
          </div>
        )}
      </div>
    </div>
  );
}

function formatTaskType(type: string) {
  switch (type) {
    case "index_library": return "索引文件库";
    case "delete_file": return "删除文件";
    case "copy_file": return "复制文件";
    case "move_file": return "移动文件";
    default: return type;
  }
}
