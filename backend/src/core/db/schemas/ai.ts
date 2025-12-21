// AI 相关表 Schema（providers、models、prompts、conversations、messages、uploads、tool_configs、conversation_files）
export const aiSchema = `
CREATE TABLE IF NOT EXISTS ai_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT,
  api_type TEXT NOT NULL,
  extra_headers_json TEXT,
  timeout_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_providers_name ON ai_providers(name);

CREATE TABLE IF NOT EXISTS ai_chat_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  provider_id INTEGER,
  model_name TEXT NOT NULL,
  api_mode TEXT NOT NULL,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  default_max_context_messages INTEGER,
  allow_override_context_limit INTEGER NOT NULL DEFAULT 1,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_chat_models_key ON ai_chat_models(key);
CREATE INDEX IF NOT EXISTS idx_ai_chat_models_enabled ON ai_chat_models(is_enabled);

CREATE TABLE IF NOT EXISTS ai_chat_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  scope TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_prompts_default ON ai_chat_prompts(is_default);

CREATE TABLE IF NOT EXISTS ai_chat_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  model_id INTEGER NOT NULL,
  title TEXT,
  metadata_json TEXT,
  system_prompt TEXT,
  max_context_messages INTEGER,
  memory_enabled INTEGER NOT NULL DEFAULT 1,
  memory_strategy TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_conversations_user_created ON ai_chat_conversations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tool_name TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_conversation_created ON ai_chat_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_chat_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  conversation_id INTEGER,
  original_name TEXT NOT NULL,
  extension TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  storage_rel_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_chat_uploads_user_created ON ai_chat_uploads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_uploads_conversation_created ON ai_chat_uploads(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  conversation_id INTEGER,
  message_id INTEGER,
  origin TEXT NOT NULL CHECK(origin IN ('upload', 'tool_generated', 'system')),
  purpose TEXT NOT NULL CHECK(purpose IN ('image', 'markdown', 'text', 'attachment', 'other')),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  extension TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  relative_path TEXT NOT NULL,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversation_files_user ON conversation_files(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_files_conversation ON conversation_files(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_files_message ON conversation_files(message_id);

CREATE TABLE IF NOT EXISTS ai_tool_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  scope TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  default_config_json TEXT,
  override_config_json TEXT,
  ui_schema_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_tool_configs_tool_key ON ai_tool_configs(tool_key);
`;
