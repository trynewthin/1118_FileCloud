import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("media and AI storage await asynchronous I/O before publishing results", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-media-storage-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/media-storage.ts")], {
      cwd: path.resolve(import.meta.dir, ".."),
      env: {
        ...process.env,
        FILECLOUD_DB_PATH: path.join(dir, "test.db"),
        FILECLOUD_DATA_DIR: dir,
        FILECLOUD_AI_UPLOADS_DIR: path.join(dir, "ai-uploads"),
        FILECLOUD_BACKGROUNDS_DIR: path.join(dir, "backgrounds"),
        FS_ALLOWED_PATHS: dir,
        JWT_SECRET: "isolated-media-storage-test-secret",
      },
      encoding: "utf8",
      timeout: 30000,
    });
    expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Async media storage regression checks passed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 35000);
