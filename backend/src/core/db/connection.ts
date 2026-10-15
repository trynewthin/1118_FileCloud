// 数据库连接配置
import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
import { getDbPath } from "../config/paths.ts";

const dbPath = getDbPath();
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Startup configures WAL under the migration lock. Negotiating it here can race
// another fresh process before either has entered the serialized bootstrap.
db.exec("PRAGMA busy_timeout = 5000"); // 等待 5 秒再报锁定错误

export { db };
