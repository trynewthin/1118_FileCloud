import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("file application commands preserve HTTP contracts and enforce policy outside HTTP", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-commands-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/file-commands.ts")], {
      env: { ...process.env, FILECLOUD_DATA_DIR: temp, FILECLOUD_DB_PATH: path.join(temp, "test.db"), FS_ALLOWED_PATHS: path.join(temp, "allowed"), JWT_SECRET: "command-test-only", SYSTEM_KEY: "" },
      encoding: "utf8", timeout: 20000,
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({ status: 0, output: "file command regressions passed\n" });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
