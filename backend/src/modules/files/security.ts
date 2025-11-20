import { db } from "../../core/db/index.ts";
import { hashSecret } from "../../core/security/hash.ts";

export interface FileEntrySecurity {
  entry_id: string;
  password_hash: string;
  hint: string | null;
  created_at: string;
  updated_at: string;
}

// 查询指定条目的密码配置
export const getEntrySecurity = (entryId: string): FileEntrySecurity | null => {
  const row = db
    .prepare(
      "SELECT entry_id, password_hash, hint, created_at, updated_at FROM file_entry_security WHERE entry_id = ?",
    )
    .get(entryId) as any | undefined;

  if (!row) return null;

  return {
    entry_id: row.entry_id,
    password_hash: row.password_hash,
    hint: row.hint ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

// 设置或更新条目的访问密码
export const setEntryPassword = (
  entryId: string,
  password: string,
  hint?: string,
): FileEntrySecurity => {
  const now = new Date().toISOString();
  const hash = hashSecret(password);

  db.prepare(
    "INSERT INTO file_entry_security(entry_id, password_hash, hint, created_at, updated_at) VALUES(?, ?, ?, ?, ?) " +
      "ON CONFLICT(entry_id) DO UPDATE SET password_hash = excluded.password_hash, hint = excluded.hint, updated_at = excluded.updated_at",
  ).run(entryId, hash, hint ?? null, now, now);

  return getEntrySecurity(entryId)!;
};

// 清除条目的访问密码
export const clearEntryPassword = (entryId: string): void => {
  db.prepare("DELETE FROM file_entry_security WHERE entry_id = ?").run(entryId);
};

// 校验访问密码，如果条目未设置密码，则直接通过
export const checkEntryPasswordIfProtected = (
  entryId: string,
  plainPassword?: string | null,
): { ok: boolean; message?: string } => {
  const security = getEntrySecurity(entryId);
  if (!security) {
    return { ok: true };
  }

  if (!plainPassword || typeof plainPassword !== "string" || plainPassword.length === 0) {
    return { ok: false, message: "需要提供访问密码" };
  }

  const hash = hashSecret(plainPassword);
  if (hash !== security.password_hash) {
    return { ok: false, message: "访问密码错误" };
  }

  return { ok: true };
};
