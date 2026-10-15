import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Startup DB initialization is intentionally synchronous: migrations, backup
// fsync and opening SQLite complete before HTTP routes or task workers start.
const startupOnly = new Set(["core/db/connection.ts", "core/db/migrations.ts"]);
const blockingFs = /\b(?:access|appendFile|chmod|chown|close|copyFile|cp|exists|fchmod|fchown|fdatasync|fstat|fsync|ftruncate|futimes|lchmod|lchown|link|lstat|lutimes|mkdir|mkdtemp|open|opendir|read|readdir|readFile|readlink|readv|realpath|rename|rm|rmdir|stat|statfs|symlink|truncate|unlink|utimes|write|writeFile|writev)Sync\b/;

test("request and background source files contain no synchronous filesystem APIs", () => {
  const root = path.resolve(import.meta.dir, "../src");
  const visit = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? visit(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const offenders = visit(root).filter(file => file.endsWith(".ts") && !startupOnly.has(path.relative(root, file)))
    .filter(file => blockingFs.test(fs.readFileSync(file, "utf8"))).map(file => path.relative(root, file));
  expect(offenders).toEqual([]);
});

test("core file workflows and probes run with blocking filesystem APIs disabled", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-async-fs-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/async-filesystem.ts")], {
      env: { ...process.env, FILECLOUD_DATA_DIR: temp, FILECLOUD_DB_PATH: path.join(temp, "test.db"), FS_ALLOWED_PATHS: temp },
      encoding: "utf8", timeout: 20000,
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({ status: 0, output: "async filesystem regressions passed\n" });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
