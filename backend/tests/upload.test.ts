import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("uploads authorize independently, close every write before indexing, and clean up failures", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-upload-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/upload.ts")], {
      env: {
        ...process.env,
        FILECLOUD_DATA_DIR: temp,
        FILECLOUD_DB_PATH: path.join(temp, "test.db"),
        FILECLOUD_AI_UPLOADS_DIR: path.join(temp, "ai-uploads"),
        FS_ALLOWED_PATHS: path.join(temp, "allowed"),
        JWT_SECRET: "upload-test-only",
        SYSTEM_KEY: "",
      },
      encoding: "utf8",
      timeout: 20000,
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({
      status: 0, output: "upload regressions passed\n",
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
