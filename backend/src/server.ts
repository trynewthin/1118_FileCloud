import { app } from "./app";
import { initDatabase } from "./core/db/index.ts";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// 启动服务前初始化数据库表结构
initDatabase();

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
