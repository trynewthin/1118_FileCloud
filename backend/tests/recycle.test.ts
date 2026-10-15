import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("recycle operations preserve conflicting, repeated, and independently deleted data", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-recycle-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/recycle.ts")], {
      env: { ...process.env, FILECLOUD_DATA_DIR: temp, FILECLOUD_DB_PATH: path.join(temp, "test.db"), FS_ALLOWED_PATHS: temp },
      encoding: "utf8",
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({ status: 0, output: "recycle regressions passed\n" });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
