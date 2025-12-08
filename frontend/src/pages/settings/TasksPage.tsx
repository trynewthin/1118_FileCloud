import { useEffect } from "react";
import { toast } from "sonner";
import { useTasks } from "@/hooks/useTasks";
import { PageContainer } from "@/components/layout/PageContainer";
import { TaskItem } from "@/components/tasks/TaskItem";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TasksPage() {
  const { items, loading, error, status, setStatus, reload } = useTasks({
    auto: true,
    status: "ALL",
  });

  // 错误时显示 toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <PageContainer
      title="任务中心"
      showBack
    >
      <Tabs
        defaultValue="ALL"
        value={status}
        onValueChange={(v) => setStatus(v as any)}
        className="w-full mb-6"
      >
        <TabsList>
          <TabsTrigger value="ALL">全部</TabsTrigger>
          <TabsTrigger value="RUNNING">进行中</TabsTrigger>
          <TabsTrigger value="SUCCESS">已完成</TabsTrigger>
          <TabsTrigger value="FAILED">失败</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {items.length === 0 && !loading ? (
          <div className="text-center text-muted-foreground py-10">暂无任务记录</div>
        ) : (
          items.map((task) => <TaskItem key={task.id} task={task} onDeleted={reload} />)
        )}
      </div>
    </PageContainer>
  );
}
