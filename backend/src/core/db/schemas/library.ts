// 文件库表 Schema
export const librarySchema = `
CREATE TABLE IF NOT EXISTS file_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  capacity_limit_bytes INTEGER,
  current_size_bytes INTEGER DEFAULT 0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  is_online_cached INTEGER NOT NULL DEFAULT 1,
  last_scanned_at TEXT,
  last_online_check_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_libraries_user_id ON file_libraries(user_id);
`;
