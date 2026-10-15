import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("watcher persists fresh checks, evicts removed libraries and obeys path policy", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-watcher-"));
  try {
    const result = Bun.spawnSync([process.execPath, path.join(import.meta.dir, "fixtures/watcher.ts")], {
      env: { ...process.env, FILECLOUD_DATA_DIR: path.join(temp, "data"), FILECLOUD_DB_PATH: path.join(temp, "data/test.db"), FILECLOUD_WATCHER_TEST_ROOT: temp, FS_ALLOWED_PATHS: path.join(temp, "libraries") },
      stdout: "pipe", stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stdout.toString() + result.stderr.toString());
    expect(result.stdout.toString()).toContain("Watcher checks passed");
  } finally { fs.rmSync(temp, { force: true, recursive: true }); }
});
