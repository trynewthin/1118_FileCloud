import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("path policy protects actual library and media services in an isolated database", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-path-services-"));
  try {
    const result = Bun.spawnSync([process.execPath, path.join(import.meta.dir, "fixtures/paths_service.ts")], {
      cwd: path.resolve(import.meta.dir, "../.."),
      env: {
        ...process.env,
        FILECLOUD_DATA_DIR: path.join(temp, "data"),
        FILECLOUD_DB_PATH: path.join(temp, "data/test.db"),
        FILECLOUD_PATH_TEST_ROOT: temp,
        FS_ALLOWED_PATHS: path.join(temp, "libraries"),
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) {
      throw new Error(`${result.stdout.toString()}\n${result.stderr.toString()}`);
    }
    expect(result.stdout.toString()).toContain("Path service regression checks passed");
    expect(fs.readFileSync(path.join(temp, "outside/private.txt"), "utf8")).toBe("private outside data");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
