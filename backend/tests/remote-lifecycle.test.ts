import { expect, test } from "bun:test";
import path from "node:path";

test("remote shutdown drains dispatched mutations, denies admission and closes upgraded sockets", () => {
  // Dedicated process: environment and module singleton state never reach other tests.
  const result = Bun.spawnSync([process.execPath, path.join(import.meta.dir, "fixtures/remote-lifecycle.ts")], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stdout.toString() + result.stderr.toString());
  expect(result.stdout.toString()).toContain("Remote lifecycle checks passed");
}, 15000);
