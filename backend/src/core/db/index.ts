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

// 启用 WAL 模式，提高并发性能，避免 "database is locked" 错误
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000"); // 等待 5 秒再报锁定错误

// 初始化数据库表结构（用户表、系统配置表、文件库表、任务表、文件索引表、操作日志表）
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
      "CREATE TABLE IF NOT EXISTS tasks (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  parent_task_id INTEGER,",
      "  type TEXT NOT NULL,",
      "  payload TEXT NOT NULL,",
      "  status TEXT NOT NULL CHECK(status IN ('PENDING','RUNNING','SUCCESS','FAILED')),",
      "  progress INTEGER NOT NULL DEFAULT 0,",
      "  detail_progress TEXT,",
      "  error_message TEXT,",
      "  created_by_user_id INTEGER,",
      "  started_at TEXT,",
      "  finished_at TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks(status, created_at DESC)",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)",
      ";",
      "CREATE TABLE IF NOT EXISTS file_entries (",
      "  id TEXT PRIMARY KEY,",
      "  library_id INTEGER NOT NULL,",
      "  parent_id TEXT,",
      "  is_directory INTEGER NOT NULL,",
      "  original_name TEXT NOT NULL,",
      "  index_suffix TEXT,",
      "  extension TEXT,",
      "  size_bytes INTEGER NOT NULL DEFAULT 0,",
      "  mime_type TEXT,",
      "  is_deleted INTEGER NOT NULL DEFAULT 0,",
      "  deleted_at TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_entries_library_parent ON file_entries(library_id, parent_id, is_deleted)",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_entries_library_name ON file_entries(library_id, is_deleted, original_name)",
      ";",
      "CREATE TABLE IF NOT EXISTS file_entry_security (",
      "  entry_id TEXT PRIMARY KEY,",
      "  password_hash TEXT NOT NULL,",
      "  hint TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE TABLE IF NOT EXISTS activity_logs (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  actor_user_id INTEGER,",
      "  actor_role TEXT,",
      "  action TEXT NOT NULL,",
      "  target_type TEXT,",
      "  target_id TEXT,",
      "  detail_json TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created ON activity_logs(actor_user_id, created_at DESC)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_providers (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  name TEXT NOT NULL,",
      "  base_url TEXT NOT NULL,",
      "  api_key TEXT,",
      "  api_type TEXT NOT NULL,",
      "  extra_headers_json TEXT,",
      "  timeout_ms INTEGER,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_providers_name ON ai_providers(name)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_chat_models (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  key TEXT NOT NULL,",
      "  display_name TEXT NOT NULL,",
      "  provider_id INTEGER,",
      "  model_name TEXT NOT NULL,",
      "  api_mode TEXT NOT NULL,",
      "  capabilities_json TEXT NOT NULL DEFAULT '[]',",
      "  default_max_context_messages INTEGER,",
      "  allow_override_context_limit INTEGER NOT NULL DEFAULT 1,",
      "  is_enabled INTEGER NOT NULL DEFAULT 1,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_chat_models_key ON ai_chat_models(key)",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ai_chat_models_enabled ON ai_chat_models(is_enabled)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_chat_prompts (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  title TEXT NOT NULL,",
      "  content TEXT NOT NULL,",
      "  scope TEXT,",
      "  is_default INTEGER NOT NULL DEFAULT 0,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ai_chat_prompts_default ON ai_chat_prompts(is_default)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_chat_conversations (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  user_id INTEGER NOT NULL,",
      "  model_id INTEGER NOT NULL,",
      "  title TEXT,",
      "  metadata_json TEXT,",
      "  system_prompt TEXT,",
      "  max_context_messages INTEGER,",
      "  memory_enabled INTEGER NOT NULL DEFAULT 1,",
      "  memory_strategy TEXT,",
      "  is_archived INTEGER NOT NULL DEFAULT 0,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_created ON ai_chat_conversations(user_id, created_at DESC)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_chat_messages (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  conversation_id INTEGER NOT NULL,",
      "  role TEXT NOT NULL,",
      "  content TEXT,",
      "  tool_name TEXT,",
      "  payload_json TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_created ON ai_chat_messages(conversation_id, created_at ASC)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_chat_uploads (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  user_id INTEGER NOT NULL,",
      "  conversation_id INTEGER,",
      "  original_name TEXT NOT NULL,",
      "  extension TEXT,",
      "  mime_type TEXT,",
      "  size_bytes INTEGER NOT NULL,",
      "  storage_rel_path TEXT NOT NULL,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ai_chat_uploads_user_created ON ai_chat_uploads(user_id, created_at DESC)",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_ai_chat_uploads_conversation_created ON ai_chat_uploads(conversation_id, created_at DESC)",
      ";",
      "CREATE TABLE IF NOT EXISTS ai_tool_configs (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  tool_key TEXT NOT NULL,",
      "  display_name TEXT NOT NULL,",
      "  description TEXT,",
      "  type TEXT NOT NULL,",
      "  scope TEXT,",
      "  is_enabled INTEGER NOT NULL DEFAULT 1,",
      "  default_config_json TEXT,",
      "  override_config_json TEXT,",
      "  ui_schema_json TEXT,",
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_tool_configs_tool_key ON ai_tool_configs(tool_key)",
      ";",
      // ============================================================================
      // 标签系统表
      // ============================================================================
      // 标签定义表
      "CREATE TABLE IF NOT EXISTS file_tags (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  name TEXT NOT NULL,",                    // 标签名称
      "  parent_tag_id INTEGER,",                 // 父标签 ID（支持嵌套，最多3层）
      "  level INTEGER NOT NULL DEFAULT 1,",      // 层级（1-3）
      "  color TEXT,",                            // 标签颜色（可选）
      "  allow_multiple INTEGER NOT NULL DEFAULT 0,", // 仅一级标签有效：是否允许多选（0=互斥单选，1=允许多选）
      "  sort_order INTEGER NOT NULL DEFAULT 0,", // 排序顺序
      "  created_at TEXT NOT NULL DEFAULT (datetime('now')),",
      "  updated_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_tags_parent ON file_tags(parent_tag_id)",
      ";",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tags_level_parent_name ON file_tags(level, parent_tag_id, name)",
      ";",
      // 文件-标签关联表
      "CREATE TABLE IF NOT EXISTS file_tag_entries (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  tag_id INTEGER NOT NULL,",               // 标签 ID
      "  entry_id TEXT NOT NULL,",                // 文件 ID（file_entries.id）
      "  is_primary INTEGER NOT NULL DEFAULT 0,", // 是否为主标签（每个文件只能有一个主标签）
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_tag_entries_tag ON file_tag_entries(tag_id)",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_tag_entries_entry ON file_tag_entries(entry_id)",
      ";",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tag_entries_tag_entry ON file_tag_entries(tag_id, entry_id)",
      ";",
      // ============================================================================
      // FTS5 全文搜索索引表
      // ============================================================================
      "CREATE VIRTUAL TABLE IF NOT EXISTS file_index_fts USING fts5(",
      "  file_id,",           // 对应 file_entries.id
      "  library_id,",        // 文件库 ID（用于过滤）
      "  name,",              // 原始文件名（主要搜索字段）
      "  path,",              // 完整路径（用于路径搜索）
      "  extension",          // 扩展名
      ")",
      ";",
      // ============================================================================
      // 文件事件表（用于增量索引和审计）
      // ============================================================================
      "CREATE TABLE IF NOT EXISTS file_events (",
      "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "  library_id INTEGER NOT NULL,",
      "  file_id TEXT NOT NULL,",
      "  event_type TEXT NOT NULL CHECK(event_type IN ('created','updated','moved','renamed','deleted')),",
      "  payload_json TEXT,",           // 额外信息（如旧路径、新路径等）
      "  processed INTEGER NOT NULL DEFAULT 0,", // 是否已被增量索引处理
      "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
      ")",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_events_unprocessed ON file_events(processed, created_at)",
      ";",
      "CREATE INDEX IF NOT EXISTS idx_file_events_library ON file_events(library_id, created_at DESC)",
      ";",
    ].join("\n"),
  );

  // 数据库迁移：为现有表添加新列
  runMigrations();
};

// 数据库迁移函数
const runMigrations = () => {
  // 检查 tasks 表是否有 parent_task_id 列，如果没有则添加
  const tasksColumns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
  const tasksColumnNames = new Set(tasksColumns.map((c) => c.name));

  if (!tasksColumnNames.has("parent_task_id")) {
    db.exec("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER");
    console.log("[DB Migration] Added parent_task_id column to tasks table");
  }

  if (!tasksColumnNames.has("detail_progress")) {
    db.exec("ALTER TABLE tasks ADD COLUMN detail_progress TEXT");
    console.log("[DB Migration] Added detail_progress column to tasks table");
  }

  // 创建 parent_task_id 索引（如果不存在）
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)");
  } catch {
    // 索引可能已存在，忽略错误
  }

  // 检查 file_entries 表是否有 index_suffix 列，如果没有则添加
  const fileEntriesColumns = db.prepare("PRAGMA table_info(file_entries)").all() as { name: string }[];
  const fileEntriesColumnNames = new Set(fileEntriesColumns.map((c) => c.name));

  if (!fileEntriesColumnNames.has("index_suffix")) {
    db.exec("ALTER TABLE file_entries ADD COLUMN index_suffix TEXT");
    console.log("[DB Migration] Added index_suffix column to file_entries table");
  }

  // 创建 index_suffix 索引（用于按后缀快速查找）
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_file_entries_library_suffix ON file_entries(library_id, index_suffix)");
  } catch {
    // 索引可能已存在，忽略错误
  }

  // 检查 file_tags 表是否有 sort_order 列，如果没有则添加
  const fileTagsColumns = db.prepare("PRAGMA table_info(file_tags)").all() as { name: string }[];
  const fileTagsColumnNames = new Set(fileTagsColumns.map((c) => c.name));

  if (!fileTagsColumnNames.has("sort_order")) {
    db.exec("ALTER TABLE file_tags ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
    console.log("[DB Migration] Added sort_order column to file_tags table");
  }

  // 检查 file_libraries 表是否有 last_online_check_at 列，如果没有则添加
  const fileLibrariesColumns = db.prepare("PRAGMA table_info(file_libraries)").all() as { name: string }[];
  const fileLibrariesColumnNames = new Set(fileLibrariesColumns.map((c) => c.name));

  if (!fileLibrariesColumnNames.has("last_online_check_at")) {
    db.exec("ALTER TABLE file_libraries ADD COLUMN last_online_check_at TEXT");
    console.log("[DB Migration] Added last_online_check_at column to file_libraries table");
  }
};

export { db, initDatabase };
