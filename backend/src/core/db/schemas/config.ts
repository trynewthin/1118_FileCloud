// 系统配置表 Schema
export const configSchema = `
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
