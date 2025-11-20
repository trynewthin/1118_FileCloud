import { db } from "../../core/db/index.ts";

export interface SystemSetting {
  key: string;
  value: string;
}

// 读取设置值，不存在时返回 undefined
export const getSetting = (key: string): string | undefined => {
  const row = db
    .prepare("SELECT key, value FROM system_config WHERE key = ?")
    .get(key) as { key: string; value: string } | undefined;

  return row?.value;
};

// 写入或更新设置值
export const setSetting = (key: string, value: string): void => {
  db.prepare(
    "INSERT INTO system_config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
};

// 列出所有设置
export const listSettings = (): SystemSetting[] => {
  const rows = db
    .prepare("SELECT key, value FROM system_config ORDER BY key ASC")
    .all() as { key: string; value: string }[];

  return rows.map((row) => ({ key: row.key, value: row.value }));
};

// 任务 worker 配置，从设置中读取，若不存在则使用默认值
export const getTaskWorkerConfig = () => {
  const intervalRaw = getSetting("tasks.worker.intervalMs");
  const batchRaw = getSetting("tasks.worker.batchSize");

  const intervalMs = intervalRaw ? Number(intervalRaw) : 1000;
  const batchSize = batchRaw ? Number(batchRaw) : 5;

  return {
    intervalMs: Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1000,
    batchSize: Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 5,
  };
};
