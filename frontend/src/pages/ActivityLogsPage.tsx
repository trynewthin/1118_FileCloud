import { useEffect } from "react";
import { toast } from "sonner";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/common/GlassCard";
import { User, Activity } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ActivityLogsPage() {
  const { items, loading, error } = useActivityLogs();

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <PageContainer
      title="操作日志"
      showBack
    >
      <GlassCard variant="lite" className="p-0 border-white/10 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-white/10">
              <TableHead>时间</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>动作</TableHead>
              <TableHead>目标</TableHead>
              <TableHead>详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  {loading ? "加载中..." : "暂无日志记录"}
                </TableCell>
              </TableRow>
            ) : (
              items.map((log) => (
                <TableRow key={log.id} className="hover:bg-white/5 border-b border-white/5">
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <User className="h-3 w-3 text-muted-foreground" />
                       <span className="text-sm">{log.actor_user_id ? `User #${log.actor_user_id}` : "System"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-sm">{log.action}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      {log.target_type && <span className="text-muted-foreground">{log.target_type}</span>}
                      <span>{log.target_id || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground" title={JSON.stringify(log.detail)}>
                    {JSON.stringify(log.detail)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </PageContainer>
  );
}
