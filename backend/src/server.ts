import { app } from "./app";
import { initDatabase } from "./core/db/index.ts";
import { startTaskWorker } from "./core/tasks/executor.ts";
import { startLibraryWatcher } from "./core/services/index.ts";
import { registerFileIndexTaskHandlers } from "./modules/files/indexTasks.ts";
import { registerFileOpsTaskHandlers } from "./modules/files/fileOpsTasks.ts";
import { registerThumbnailTaskHandlers } from "./modules/fileContent/thumbnailTasks.ts";
import { registerTranscodeTaskHandlers } from "./modules/fileContent/transcodeTasks.ts";
import { getTaskWorkerConfig } from "./modules/settings/service.ts";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// 启动服务前初始化数据库表结构
initDatabase();

// 注册文件索引、文件操作、缩略图及转码相关任务处理器
registerFileIndexTaskHandlers();
registerFileOpsTaskHandlers();
registerThumbnailTaskHandlers();
registerTranscodeTaskHandlers();

// 读取任务 worker 配置并启动 worker
const workerConfig = getTaskWorkerConfig();
console.log("Task worker config", workerConfig);
startTaskWorker(workerConfig);

// 启动文件库在线状态监控服务
startLibraryWatcher();

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
