// 数据库模块入口 - 统一导出数据库实例和初始化函数
import { db } from "./connection.ts";
import {
  userSchema,
  configSchema,
  librarySchema,
  taskSchema,
  fileSchema,
  logSchema,
  aiSchema,
  tagSchema,
} from "./schemas/index.ts";

// 初始化数据库表结构
const initDatabase = () => {
  // 按领域顺序执行各模块的 Schema
  db.exec(userSchema);
  db.exec(configSchema);
  db.exec(librarySchema);
  db.exec(taskSchema);
  db.exec(fileSchema);
  db.exec(logSchema);
  db.exec(aiSchema);
  db.exec(tagSchema);
};

export { db, initDatabase };
