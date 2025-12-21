// 用户表 Schema
export const userSchema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  secret_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_secret_hash ON users(secret_hash) WHERE secret_hash IS NOT NULL;
`;
