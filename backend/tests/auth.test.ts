import { test, expect } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("REST and AI share user/library/entry authorization boundaries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-auth-"));
  try {
    const result = spawnSync(process.execPath, [path.join(import.meta.dir, "fixtures/auth.ts")], {
      cwd: path.resolve(import.meta.dir, ".."),
      env: {
        ...process.env,
        FILECLOUD_DB_PATH: path.join(dir, "test.db"),
        FILECLOUD_DATA_DIR: dir,
        FILECLOUD_AI_UPLOADS_DIR: path.join(dir, "ai-uploads"),
        FILECLOUD_BACKGROUNDS_DIR: path.join(dir, "backgrounds"),
        FS_ALLOWED_PATHS: dir,
        JWT_SECRET: "isolated-authorization-test-secret",
      },
      encoding: "utf8",
      timeout: 30000,
    });
    expect(result.error, `${result.stdout}\n${result.stderr}`).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Authorization regression checks passed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, 35000);
