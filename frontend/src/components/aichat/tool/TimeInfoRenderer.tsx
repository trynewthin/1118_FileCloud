import { Clock } from "lucide-react";
import type { ToolCallResult } from "./types";

export function TimeInfoRenderer({ result }: { result: ToolCallResult }) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-primary" />
      <span className="text-sm">
        {result.date} {result.time}
      </span>
    </div>
  );
}
