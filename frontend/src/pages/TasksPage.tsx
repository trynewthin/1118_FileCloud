import { useTasks } from "@/hooks/useTasks";
import { PageContainer } from "@/components/layout/PageContainer";
import { TaskItem } from "@/components/tasks/TaskItem";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { GlassButton } from "@/components/common/GlassButton";

export function TasksPage() {
  const { items, loading, error, reload, status, setStatus } = useTasks({
    auto: true,
    status: "ALL",
  });

  return (
    <PageContainer
      title="任务中心"
      showBack
      action={
        <div className="flex gap-2">
          <GlassButton
            glassVariant="lite"
            size="sm"
            onClick={() => reload()}
            disabled={loading}
            className="gap-2 px-3"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>刷新</span>
          </GlassButton>
        </div>
      }
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

      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      <div className="space-y-4">
        {loading && items.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">加载中...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">暂无任务记录</div>
        ) : (
          items.map((task) => <TaskItem key={task.id} task={task} />)
        )}
      </div>
    </PageContainer>
  );
}
