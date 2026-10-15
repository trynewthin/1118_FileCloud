import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, cpSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applySchemaMigrations, migrationsFolder } from "../src/core/db/migrations.ts";

// This fixture is frozen from the last pre-migration Git revision, so a mistake
// in the new migration cannot silently change both the expected and actual DDL.
const legacySql = readFileSync(new URL("./fixtures/legacy-173ae4d.sql", import.meta.url), "utf8");
const legacy = (db: Database) => db.exec(legacySql);
const customLedger = `CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO schema_migrations(version,name) VALUES(1, 'initial-schema-with-trash-locations');`;
const sample = (db: Database) => {
  db.query("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run("retained-user", "fixture-hash");
  db.exec(`
    INSERT INTO file_libraries(id, user_id, root_path, display_name) VALUES(1, 1, '/fixture/never-open', 'Retained library');
    INSERT INTO file_entries(id, library_id, is_directory, original_name, size_bytes) VALUES('retained-file', 1, 0, 'document.txt', 1234);
    INSERT INTO file_tags(id, user_id, name, color) VALUES(1, 1, 'Retained tag', '#123456');
    INSERT INTO file_tag_entries(tag_id, entry_id, is_primary) VALUES(1, 'retained-file', 1);
    INSERT INTO tasks(type, payload, status) VALUES('fixture-only', '{"fileId":"retained-file"}', 'PENDING');
    INSERT INTO system_config(key, value) VALUES('fixture-setting', 'retained-value');
    INSERT INTO file_index_fts(file_id, library_id, name, path, extension) VALUES('retained-file', 1, 'findable document', 'folder/document.txt', 'txt');
  `);
};
const assertRetained = (db: Database) => {
  expect(db.query("SELECT username, password_hash FROM users").all()).toEqual([{ username: "retained-user", password_hash: "fixture-hash" }]);
  expect(db.query("SELECT user_id, root_path, display_name FROM file_libraries").all())
    .toEqual([{ user_id: 1, root_path: "/fixture/never-open", display_name: "Retained library" }]);
  expect(db.query("SELECT id, library_id, original_name, size_bytes FROM file_entries").all())
    .toEqual([{ id: "retained-file", library_id: 1, original_name: "document.txt", size_bytes: 1234 }]);
  expect(db.query("SELECT user_id, name, color FROM file_tags").all())
    .toEqual([{ user_id: 1, name: "Retained tag", color: "#123456" }]);
  expect(db.query("SELECT tag_id, entry_id, is_primary FROM file_tag_entries").all())
    .toEqual([{ tag_id: 1, entry_id: "retained-file", is_primary: 1 }]);
  expect(db.query("SELECT type, payload, status FROM tasks").all())
    .toEqual([{ type: "fixture-only", payload: '{"fileId":"retained-file"}', status: "PENDING" }]);
  expect(db.query("SELECT key, value FROM system_config").all()).toEqual([{ key: "fixture-setting", value: "retained-value" }]);
  expect(db.query("SELECT file_id FROM file_index_fts WHERE file_index_fts MATCH 'findable'").all()).toEqual([{ file_id: "retained-file" }]);
};
const fixture = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "filecloud-migration-"));
  const db = new Database(path.join(dir, "fixture.sqlite"));
  return { dir, db, close: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
};
const upgradeFolder = (dir: string, sql: string) => {
  const folder = path.join(dir, "migrations");
  cpSync(migrationsFolder, folder, { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(folder, "meta/_journal.json"), "utf8"));
  journal.entries.push({ idx: 2, version: "6", when: 1760000000002, tag: "0002_fixture", breakpoints: true });
  writeFileSync(path.join(folder, "meta/_journal.json"), JSON.stringify(journal));
  writeFileSync(path.join(folder, "0002_fixture.sql"), sql);
  return folder;
};

test("fresh bootstrap uses Drizzle ordered SQL history and idempotent restart", () => {
  const db = new Database(":memory:");
  try {
    expect(applySchemaMigrations(db).applied).toBe(2);
    sample(db);
    expect(applySchemaMigrations(db)).toEqual({ applied: 0 });
    assertRetained(db);
    expect(db.query("SELECT COUNT(*) AS n FROM __drizzle_migrations").get()).toEqual({ n: 2 });
  } finally { db.close(); }
});

test("original unversioned schema upgrades with a standalone verified WAL snapshot", () => {
  const f = fixture();
  try {
    f.db.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0");
    legacy(f.db); sample(f.db);
    expect(statSync(`${f.db.filename}-wal`).size).toBeGreaterThan(0);
    const result = applySchemaMigrations(f.db);
    expect(result.applied).toBe(2); expect(result.backup).toBeDefined();
    const backup = new Database(result.backup!, { readonly: true });
    try {
      assertRetained(backup);
      expect(backup.query("SELECT name FROM sqlite_master WHERE name='file_trash_locations'").get()).toBeNull();
      expect(backup.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    } finally { backup.close(); }
    assertRetained(f.db);
  } finally { f.close(); }
});

test("previous custom version-one ledger is adopted without dropping data", () => {
  const f = fixture();
  try {
    legacy(f.db); sample(f.db);
    // This is the previous custom version's DDL, independent of migration files.
    f.db.exec("CREATE TABLE file_trash_locations (\n  entry_id TEXT PRIMARY KEY,\n  relative_path TEXT NOT NULL\n)");
    f.db.exec(customLedger);
    f.db.query("INSERT INTO file_trash_locations(entry_id, relative_path) VALUES(?,?)").run("retained-entry", "trash/original.txt");
    expect(applySchemaMigrations(f.db).applied).toBe(2);
    assertRetained(f.db);
    expect(f.db.query("SELECT relative_path FROM file_trash_locations WHERE entry_id='retained-entry'").get())
      .toEqual({ relative_path: "trash/original.txt" });
    expect(applySchemaMigrations(f.db).applied).toBe(0);
  } finally { f.close(); }
});

test("unknown or partial unversioned layouts fail closed, never blindly stamp", () => {
  for (const sql of ["CREATE TABLE users(id INTEGER)", "CREATE TABLE unrelated(value TEXT)", "CREATE TABLE sqliteXunrecognized(value TEXT)"]) {
    const db = new Database(":memory:");
    try {
      db.exec(sql);
      expect(() => applySchemaMigrations(db)).toThrow("Unrecognized legacy");
      expect(db.query("SELECT name FROM sqlite_master WHERE name='__drizzle_migrations'").get()).toBeNull();
    } finally { db.close(); }
  }
});

test("legacy validation preserves quoted constraint values and literal whitespace", () => {
  const f = fixture();
  try {
    const folder = upgradeFolder(f.dir, "SELECT 1;");
    const baseline = path.join(folder, "0000_legacy_baseline.sql");
    // Whitespace inside a string is data; outside tokens it is formatting.
    writeFileSync(baseline, readFileSync(baseline, "utf8").replace("'admin'", "'ad min'"));
    for (const value of ["AD MIN", "ad  min"]) {
      const db = new Database(":memory:");
      try {
        db.exec(legacySql.replace("'admin'", `'${value}'`));
        expect(() => applySchemaMigrations(db, { migrationsFolder: folder })).toThrow("Unrecognized legacy");
        expect(db.query("SELECT name FROM sqlite_master WHERE name='__drizzle_migrations'").get()).toBeNull();
      } finally { db.close(); }
    }
  } finally { f.close(); }
});

test("a custom ledger with missing business tables cannot authorize fresh adoption", () => {
  for (const sql of [customLedger, `${legacySql}\n${customLedger}`]) {
    const db = new Database(":memory:");
    try {
      db.exec(sql);
      expect(() => applySchemaMigrations(db)).toThrow("Unrecognized legacy");
      expect(db.query("SELECT name FROM sqlite_master WHERE name='__drizzle_migrations'").get()).toBeNull();
    } finally { db.close(); }
  }
});

test("backup failure aborts before any migration writes", () => {
  const f = fixture();
  try {
    legacy(f.db); sample(f.db);
    const blocked = path.join(f.dir, "not-a-directory"); writeFileSync(blocked, "fixture");
    expect(() => applySchemaMigrations(f.db, { backupDirectory: blocked })).toThrow();
    expect(f.db.query("SELECT name FROM sqlite_master WHERE name='__drizzle_migrations'").get()).toBeNull();
    expect(f.db.query("SELECT name FROM sqlite_master WHERE name='file_trash_locations'").get()).toBeNull();
    assertRetained(f.db);
  } finally { f.close(); }
});

test("failed ordered upgrade rolls back DDL and history, then retries", () => {
  const f = fixture();
  try {
    applySchemaMigrations(f.db); sample(f.db);
    const folder = upgradeFolder(f.dir, "ALTER TABLE users ADD COLUMN fixture TEXT;\n--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);");
    expect(() => applySchemaMigrations(f.db, { migrationsFolder: folder })).toThrow();
    expect(f.db.query("PRAGMA table_info(users)").all().some((r: any) => r.name === "fixture")).toBe(false);
    expect(f.db.query("SELECT COUNT(*) AS n FROM __drizzle_migrations").get()).toEqual({ n: 2 });
    writeFileSync(path.join(folder, "0002_fixture.sql"), "ALTER TABLE users ADD COLUMN fixture TEXT;");
    expect(applySchemaMigrations(f.db, { migrationsFolder: folder }).applied).toBe(1);
    assertRetained(f.db);
    expect(() => applySchemaMigrations(f.db)).toThrow("newer");
  } finally { f.close(); }
});

test("a failed first adoption leaves no applied history and can retry safely", () => {
  const f = fixture();
  try {
    legacy(f.db); sample(f.db);
    const folder = upgradeFolder(f.dir, "INSERT INTO missing_table VALUES (1);");
    expect(() => applySchemaMigrations(f.db, { migrationsFolder: folder })).toThrow();
    // Drizzle creates its empty ledger before BEGIN; the rows and trash DDL
    // must nevertheless roll back with the failed adoption transaction.
    expect(f.db.query("SELECT COUNT(*) AS n FROM __drizzle_migrations").get()).toEqual({ n: 0 });
    expect(f.db.query("SELECT name FROM sqlite_master WHERE name='file_trash_locations'").get()).toBeNull();
    assertRetained(f.db);
    writeFileSync(path.join(folder, "0002_fixture.sql"), "SELECT 1;");
    expect(applySchemaMigrations(f.db, { migrationsFolder: folder }).applied).toBe(3);
    assertRetained(f.db);
  } finally { f.close(); }
});

test("modified checksums, gaps and future history are refused", () => {
  for (const sql of ["UPDATE __drizzle_migrations SET hash='tampered' WHERE created_at=1760000000000", "DELETE FROM __drizzle_migrations WHERE created_at=1760000000000", "INSERT INTO __drizzle_migrations(hash,created_at) VALUES ('future',9999999999999)"]) {
    const db = new Database(":memory:");
    try { applySchemaMigrations(db); db.exec(sql); expect(() => applySchemaMigrations(db)).toThrow("history"); }
    finally { db.close(); }
  }
});

test("out-of-order migration journal is rejected before database changes", () => {
  const f = fixture();
  try {
    const folder = upgradeFolder(f.dir, "SELECT 1;");
    const journalPath = path.join(folder, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")); journal.entries.reverse();
    writeFileSync(journalPath, JSON.stringify(journal));
    expect(() => applySchemaMigrations(f.db, { migrationsFolder: folder })).toThrow("strictly ordered");
    expect(f.db.query("SELECT name FROM sqlite_master").all()).toEqual([]);
  } finally { f.close(); }
});

test("concurrent startups serialize through a crash-released SQLite lock", async () => {
  const f = fixture();
  try {
    legacy(f.db); sample(f.db);
    const script = path.join(f.dir, "worker.ts");
    const modulePath = path.resolve(import.meta.dir, "../src/core/db/migrations.ts");
    const connectionPath = path.resolve(import.meta.dir, "../src/core/db/connection.ts");
    writeFileSync(script, `import {db} from ${JSON.stringify(connectionPath)}; import {applySchemaMigrations} from ${JSON.stringify(modulePath)}; try { console.log(JSON.stringify(applySchemaMigrations(db))); } finally { db.close(); }`);
    const jobs = [1, 2, 3].map(() => Bun.spawn([process.execPath, script], {
      env: { ...process.env, FILECLOUD_DB_PATH: f.db.filename }, stdout: "pipe", stderr: "pipe",
    }));
    const results = await Promise.all(jobs.map(async p => {
      const [out, err, exit] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
      expect(err).toBe(""); expect(exit).toBe(0); return JSON.parse(out).applied;
    }));
    expect(results.sort()).toEqual([0, 0, 2]); assertRetained(f.db);
    const lockScript = path.join(f.dir, "lock.ts");
    writeFileSync(lockScript, "import {Database} from 'bun:sqlite'; const db=new Database(process.argv[2]); db.exec('BEGIN IMMEDIATE'); console.log('locked'); setInterval(()=>{},1000)");
    const holder = Bun.spawn([process.execPath, lockScript, `${f.db.filename}.migration-lock`], { stdout: "pipe", stderr: "pipe" });
    const reader = holder.stdout.getReader(); await reader.read();
    expect(() => applySchemaMigrations(f.db, { lockTimeoutMs: 1 })).toThrow();
    holder.kill("SIGKILL"); await holder.exited;
    expect(applySchemaMigrations(f.db).applied).toBe(0);
  } finally { f.close(); }
});

test("SIGKILL before Drizzle commit rolls back pending DDL and history and releases the lock", async () => {
  const f = fixture();
  let worker: ReturnType<typeof Bun.spawn> | undefined;
  try {
    f.db.exec("PRAGMA journal_mode=WAL");
    applySchemaMigrations(f.db); sample(f.db);
    const folder = upgradeFolder(f.dir, "ALTER TABLE users ADD COLUMN crash_fixture TEXT;");
    const marker = path.join(f.dir, "transaction-ready.json");
    const script = path.join(f.dir, "crash-worker.ts");
    const modulePath = path.resolve(import.meta.dir, "../src/core/db/migrations.ts");
    // Only pause the real Drizzle transaction at a deterministic checkpoint.
    // The database, statements, OS process kill and SQLite recovery are real.
    writeFileSync(script, `
      import { Database } from "bun:sqlite";
      import { writeFileSync } from "node:fs";
      import { applySchemaMigrations } from ${JSON.stringify(modulePath)};
      const db = new Database(process.argv[2]);
      const prepare = db.prepare.bind(db);
      db.prepare = (sql, ...args) => {
        if (sql.trim().toUpperCase() === "COMMIT") {
          writeFileSync(process.argv[4], JSON.stringify({
            inTransaction: db.inTransaction,
            hasColumn: prepare("PRAGMA table_info(users)").all().some(r => r.name === "crash_fixture"),
            history: prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations").get().n,
          }));
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
        }
        return prepare(sql, ...args);
      };
      applySchemaMigrations(db, { migrationsFolder: process.argv[3] });
      db.close();
    `);
    worker = Bun.spawn([process.execPath, script, f.db.filename, folder, marker], { stdout: "pipe", stderr: "pipe" });
    const deadline = Date.now() + 4_000;
    while (!existsSync(marker) && worker.exitCode === null && Date.now() < deadline) await Bun.sleep(10);
    expect(existsSync(marker)).toBe(true);
    expect(JSON.parse(readFileSync(marker, "utf8"))).toEqual({ inTransaction: true, hasColumn: true, history: 3 });
    worker.kill("SIGKILL"); await worker.exited;
    expect(f.db.query("PRAGMA table_info(users)").all().some((r: any) => r.name === "crash_fixture")).toBe(false);
    expect(f.db.query("SELECT COUNT(*) AS n FROM __drizzle_migrations").get()).toEqual({ n: 2 });
    assertRetained(f.db);
    expect(applySchemaMigrations(f.db, { migrationsFolder: folder, lockTimeoutMs: 100 }).applied).toBe(1);
    expect(f.db.query("PRAGMA table_info(users)").all().some((r: any) => r.name === "crash_fixture")).toBe(true);
    assertRetained(f.db);
  } finally {
    if (worker && worker.exitCode === null) { worker.kill("SIGKILL"); await worker.exited; }
    f.close();
  }
});

test("application bootstrap waits for a competing lock before negotiating WAL", async () => {
  const f = fixture();
  let worker: ReturnType<typeof Bun.spawn> | undefined;
  try {
    legacy(f.db); sample(f.db);
    f.db.exec("BEGIN EXCLUSIVE");
    const script = path.join(f.dir, "connection-worker.ts");
    const modulePath = path.resolve(import.meta.dir, "../src/core/db/connection.ts");
    const migrationPath = path.resolve(import.meta.dir, "../src/core/db/migrations.ts");
    writeFileSync(script, `import {db} from ${JSON.stringify(modulePath)}; import {applySchemaMigrations} from ${JSON.stringify(migrationPath)}; applySchemaMigrations(db); console.log(db.query("PRAGMA journal_mode").get().journal_mode); db.close();`);
    const child = Bun.spawn([process.execPath, script], {
      env: { ...process.env, FILECLOUD_DB_PATH: f.db.filename }, stdout: "pipe", stderr: "pipe",
    });
    worker = child;
    const state = await Promise.race([child.exited.then(() => "exited"), Bun.sleep(100).then(() => "waiting")]);
    expect(state).toBe("waiting");
    f.db.exec("ROLLBACK");
    const [out, err, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(exit).toBe(0); expect(err).toBe(""); expect(out.trim()).toBe("wal");
    assertRetained(f.db);
  } finally {
    if (f.db.inTransaction) f.db.exec("ROLLBACK");
    if (worker && worker.exitCode === null) { worker.kill("SIGKILL"); await worker.exited; }
    f.close();
  }
});
