// 标签系统表 Schema（file_tags、file_tag_entries）
export const tagSchema = `
CREATE TABLE IF NOT EXISTS file_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  parent_tag_id INTEGER,
  level INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  allow_multiple INTEGER NOT NULL DEFAULT 0,
  show_ancestor_chain INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_file_tags_parent ON file_tags(parent_tag_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_user ON file_tags(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tags_user_level_parent_name ON file_tags(user_id, level, parent_tag_id, name);

CREATE TABLE IF NOT EXISTS file_tag_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id INTEGER NOT NULL,
  entry_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_file_tag_entries_tag ON file_tag_entries(tag_id);
CREATE INDEX IF NOT EXISTS idx_file_tag_entries_entry ON file_tag_entries(entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tag_entries_tag_entry ON file_tag_entries(tag_id, entry_id);
`;
