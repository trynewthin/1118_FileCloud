import { useState } from "react";
import { AlertTriangle, Check, Move, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassButton } from "@/components/common/button/GlassButton";
import type { PendingAction, ToolCallResult } from "./types";

export function PendingActionRenderer({
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
