import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_FILE_NAME = "filecloud.db";
const projectRoot = path.resolve(process.cwd(), "..");
const dbDir = path.join(projectRoot, "database");
const dbPath = path.join(dbDir, DB_FILE_NAME);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// 初始化数据库表结构（用户表、系统配置表、文件库表）
const initDatabase = () => {
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS users (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  username TEXT,",
      "  secret_hash TEXT NOT NULL,",
      "  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_secret_hash ON users(secret_hash);",
      "CREATE TABLE IF NOT EXISTS system_config (",
      "  key TEXT PRIMARY KEY,",
      "  value TEXT NOT NULL",
      ")",
      ";",
      "CREATE TABLE IF NOT EXISTS file_libraries (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  root_path TEXT NOT NULL UNIQUE,",
      "  display_name TEXT NOT NULL,",
      "  capacity_limit_bytes INTEGER,",
      "  current_size_bytes INTEGER DEFAULT 0,",
      "  is_enabled INTEGER NOT NULL DEFAULT 1,",
      "  is_online_cached INTEGER NOT NULL DEFAULT 1,",
      "  last_scanned_at TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
    ].join("\n"),
  );
};

export { db, initDatabase };
