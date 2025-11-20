import { app } from "./app";
import { initDatabase } from "./core/db/index.ts";
import { startTaskWorker } from "./core/tasks/executor.ts";
import { registerFileIndexTaskHandlers } from "./modules/files/indexTasks.ts";
import { registerFileOpsTaskHandlers } from "./modules/files/fileOpsTasks.ts";
import { getTaskWorkerConfig } from "./modules/settings/service.ts";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// 启动服务前初始化数据库表结构
initDatabase();

// 注册文件索引及文件操作相关任务处理器
registerFileIndexTaskHandlers();
registerFileOpsTaskHandlers();

// 读取任务 worker 配置并启动 worker
const workerConfig = getTaskWorkerConfig();
console.log("Task worker config", workerConfig);
startTaskWorker(workerConfig);

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
