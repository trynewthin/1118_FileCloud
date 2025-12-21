// 文件相关表 Schema（file_entries、file_entry_security、file_events、file_transcodes、file_index_fts）
export const fileSchema = `
CREATE TABLE IF NOT EXISTS file_entries (
  id TEXT PRIMARY KEY,
  library_id INTEGER NOT NULL,
  parent_id TEXT,
  is_directory INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  index_suffix TEXT,
  extension TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_file_entries_library_parent ON file_entries(library_id, parent_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_file_entries_library_name ON file_entries(library_id, is_deleted, original_name);
CREATE INDEX IF NOT EXISTS idx_file_entries_library_suffix ON file_entries(library_id, index_suffix);

CREATE TABLE IF NOT EXISTS file_entry_security (
  entry_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  hint TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS file_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  file_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('created','updated','moved','renamed','deleted')),
  payload_json TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_file_events_unprocessed ON file_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_file_events_library ON file_events(library_id, created_at DESC);

CREATE TABLE IF NOT EXISTS file_transcodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL,
  library_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  output_path TEXT,
  output_size INTEGER,
  error_message TEXT,
  task_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_transcodes_entry ON file_transcodes(entry_id);
CREATE INDEX IF NOT EXISTS idx_file_transcodes_library ON file_transcodes(library_id);
CREATE INDEX IF NOT EXISTS idx_file_transcodes_status ON file_transcodes(status);

CREATE VIRTUAL TABLE IF NOT EXISTS file_index_fts USING fts5(
  file_id,
  library_id,
  name,
  path,
  extension
);
`;
