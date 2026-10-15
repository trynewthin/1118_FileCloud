import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { mkdirSync, realpathSync, openSync, fsyncSync, closeSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const migrationsFolder = fileURLToPath(new URL("../../../drizzle", import.meta.url));
const ledger = "__drizzle_migrations";
interface SchemaObject { type: string; name: string; sql: string | null }
interface AppliedMigration { hash: string; created_at: number }
export interface MigrationOptions {
  migrationsFolder?: string;
  backupDirectory?: string;
  lockTimeoutMs?: number;
}

const schema = (database: Database): SchemaObject[] => database.query(
  "SELECT type, name, sql FROM sqlite_master WHERE lower(substr(name, 1, 7)) != 'sqlite_' ORDER BY type, name",
).all() as SchemaObject[];
// Whitespace and keyword case are irrelevant outside quoted SQL tokens. Changing
// a quoted value's case/spacing would hide incompatible CHECKs or defaults.
const normalize = (sql: string | null) => sql?.split(/('(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\])/g)
  .map((part, index) => index % 2 ? part : part.replace(/\s+/g, " ").toLowerCase()).join("").trim();
const integrityCheck = (database: Database) => {
  const result = database.query("PRAGMA integrity_check").all() as { integrity_check: string }[];
  if (result.length !== 1 || result[0]?.integrity_check !== "ok") {
    throw new Error("Database integrity check failed; stop and restore a verified backup");
  }
};

/** Only recognized historical layouts may be adopted. CREATE IF NOT EXISTS alone
 * cannot verify types, constraints, indexes, or a partially initialized database. */
const validateLegacySchema = (database: Database, initialSql: readonly string[], trashSql: readonly string[], prior: boolean) => {
  const actual = schema(database).filter(row => row.name !== "schema_migrations" && row.name !== ledger);
  if (actual.length === 0) {
    if (prior) {
      throw new Error("Unrecognized legacy database schema; migration history has no business tables");
    }
    return;
  }
  const expected = new Database(":memory:");
  try {
    for (const statement of initialSql) expected.exec(statement);
    if (prior || actual.some(row => row.name === "file_trash_locations")) {
      for (const statement of trashSql) expected.exec(statement);
    }
    const wanted = schema(expected);
    if (actual.length !== wanted.length || actual.some((row, index) => {
      const target = wanted[index];
      return !target || row.type !== target.type || row.name !== target.name || normalize(row.sql) !== normalize(target.sql);
    })) throw new Error("Unrecognized legacy database schema; automatic adoption refused");
  } finally { expected.close(); }
};

/** VACUUM INTO is SQLite's consistent snapshot operation, including committed WAL
 * content. Never copy just the live .sqlite file. Keep failed snapshots for inspection. */
const backupDatabase = (database: Database, filename: string, directory: string): string => {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = path.join(directory, `${path.basename(filename)}.${Date.now()}.${crypto.randomUUID()}.sqlite`);
  // Reserve with restrictive permissions before SQLite opens it (empty files are supported).
  const fd = openSync(backup, "wx", 0o600);
  closeSync(fd);
  database.query("VACUUM INTO ?").run(backup);
  chmodSync(backup, 0o600);
  const copy = new Database(backup, { readonly: true });
  try { integrityCheck(copy); } finally { copy.close(); }
  const synced = openSync(backup, "r");
  try { fsyncSync(synced); } finally { closeSync(synced); }
  const parent = openSync(directory, "r");
  try { fsyncSync(parent); } finally { closeSync(parent); }
  return backup;
};

/** Drizzle owns SQL ordering, execution, and atomic rollback/history writes.
 * This startup-only safety wrapper adds strict history validation, legacy adoption,
 * backup and cross-process serialization. No application queries use an ORM.
 * Stop every older application instance before upgrading; the lock coordinates
 * migrators, not arbitrary writers using an older schema. */
export const applySchemaMigrations = (database: Database, options: MigrationOptions = {}): { applied: number; backup?: string } => {
  const folder = options.migrationsFolder ?? migrationsFolder;
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  if (migrations.length < 2 || migrations.some((entry, index) => !Number.isSafeInteger(entry.folderMillis)
    || (index > 0 && entry.folderMillis <= migrations[index - 1]!.folderMillis))) {
    throw new Error("Migration journal must contain strictly ordered baseline and upgrade entries");
  }
  const memory = database.filename === ":memory:" || database.filename === "";
  const filename = memory ? "" : realpathSync(database.filename);
  let lock: Database | undefined;
  try {
    if (!memory) {
      // A separate SQLite file lets VACUUM INTO and Drizzle own source transactions.
      // SQLite releases the OS lock on crash. Never unlink this coordination file.
      lock = new Database(`${filename}.migration-lock`);
      lock.exec(`PRAGMA busy_timeout = ${Math.max(0, Math.min(options.lockTimeoutMs ?? 30_000, 300_000))}`);
      lock.exec("BEGIN IMMEDIATE");
      // journal_mode may need a lock upgrade that fails immediately despite a
      // busy timeout. Serialize it with migration startup, not connection import.
      database.exec("PRAGMA journal_mode = WAL");
    }
    const objects = schema(database);
    const prior = objects.some(row => row.name === "schema_migrations");
    if (prior) {
      const old = database.query("SELECT version, name FROM schema_migrations ORDER BY version").all() as { version: number; name: string }[];
      if (old.length !== 1 || old[0]?.version !== 1 || old[0]?.name !== "initial-schema-with-trash-locations") {
        throw new Error("Incompatible legacy migration history; upgrade refused");
      }
    }
    const applied = objects.some(row => row.name === ledger)
      ? database.query(`SELECT hash, created_at FROM ${ledger} ORDER BY created_at`).all() as AppliedMigration[]
      : [];
    if (applied.length > migrations.length || applied.some((row, index) => row.created_at !== migrations[index]?.folderMillis || row.hash !== migrations[index]?.hash)) {
      throw new Error("Database migration history is newer, incomplete, or modified; upgrade refused");
    }
    if (applied.length === migrations.length) return { applied: 0 };
    integrityCheck(database);
    if (applied.length === 0) validateLegacySchema(database, migrations[0]!.sql, migrations[1]!.sql, prior);
    const backup = !memory && objects.length > 0
      ? backupDatabase(database, filename, options.backupDirectory ?? `${filename}.backups`)
      : undefined;
    // Drizzle's transaction rolls back every pending migration and its ledger row.
    migrate(drizzle(database), { migrationsFolder: folder });
    integrityCheck(database);
    return { applied: migrations.length - applied.length, backup };
  } finally {
    if (lock) {
      try { if (lock.inTransaction) lock.exec("ROLLBACK"); } finally { lock.close(); }
    }
  }
};
