import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("move/copy independently authorize source and target credentials without persisting them", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-transfer-credentials-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/move-copy-credentials.ts")], {
      env: { ...process.env, FILECLOUD_DATA_DIR: temp, FILECLOUD_DB_PATH: path.join(temp, "test.db"), FS_ALLOWED_PATHS: temp, JWT_SECRET: "transfer-test-only", SYSTEM_KEY: "" },
      encoding: "utf8", timeout: 20000,
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({ status: 0, output: "move/copy credential regressions passed\n" });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
