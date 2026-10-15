import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { db, initDatabase } from "../../src/core/db/index.ts";
import { startLibraryWatcher, stopLibraryWatcher, isLibraryOnline, getAllLibraryStatus, getCheckInterval, refreshLibraryStatus } from "../../src/modules/coreServices/libraryWatcher.ts";
import { assertExistingLibraryRootPathAsync } from "../../src/core/config/pathSecurity.ts";
const fixture = process.env.FILECLOUD_WATCHER_TEST_ROOT!;
assert.ok(fixture.includes("filecloud-watcher-"));
const allowed = path.join(fixture, "libraries");
const root = path.join(allowed, "root");
const outside = path.join(fixture, "outside");
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(outside);
fs.symlinkSync(outside, path.join(allowed, "escape"));
await assert.rejects(assertExistingLibraryRootPathAsync(path.join(allowed, "escape")));
await assert.rejects(assertExistingLibraryRootPathAsync(outside));
fs.writeFileSync(path.join(root, "file"), "data");
await assert.rejects(assertExistingLibraryRootPathAsync(path.join(root, "file")));
initDatabase();
db.query("INSERT INTO file_libraries(id, user_id, root_path, display_name) VALUES (1, 1, ?, 'one'), (2, 1, ?, 'outside')").run(root, outside);
const waitFor = async (condition: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "Watcher condition timed out");
    await Bun.sleep(5);
  }
};
startLibraryWatcher(5);
try {
  assert.equal(getCheckInterval(), 5);
  await waitFor(() => getAllLibraryStatus().every(row => !!row.lastCheckAt && row.lastCheckAt.includes("T")));
  assert.equal((await isLibraryOnline(1)), true);
  assert.equal((await isLibraryOnline(2)), false);
  const previous = getAllLibraryStatus()[0]!.lastCheckAt;
  await waitFor(() => getAllLibraryStatus()[0]!.lastCheckAt !== previous);
  db.query("UPDATE file_libraries SET is_enabled = 0 WHERE id = 1").run();
  assert.equal((await isLibraryOnline(1)), false);
  assert.equal(getAllLibraryStatus()[0]!.isOnline, false);
  db.query("DELETE FROM file_libraries WHERE id = 2").run();
  assert.equal((await isLibraryOnline(2)), false);
  await Bun.sleep(20);
} finally { await stopLibraryWatcher(); }
const before = db.query("SELECT last_online_check_at FROM file_libraries WHERE id = 1").get();
await Bun.sleep(20);
assert.deepEqual(db.query("SELECT last_online_check_at FROM file_libraries WHERE id = 1").get(), before);
// Direct refreshes also yield: disabling a library mid-probe must not publish
// stale online state, and stop must drain the active directory handle.
db.query("UPDATE file_libraries SET is_enabled = 1 WHERE id = 1").run();
const originalOpendir = fs.promises.opendir;
let release!: () => void;
let started!: () => void;
const ready = new Promise<void>(resolve => { started = resolve; });
const gate = new Promise<void>(resolve => { release = resolve; });
fs.promises.opendir = (async (...args: Parameters<typeof originalOpendir>) => {
  started();
  await gate;
  return originalOpendir(...args);
}) as typeof originalOpendir;
try {
  const refresh = refreshLibraryStatus(1);
  await ready;
  db.query("UPDATE file_libraries SET is_enabled = 0 WHERE id = 1").run();
  let stopped = false;
  const stopping = stopLibraryWatcher().then(() => { stopped = true; });
  await Bun.sleep(10);
  assert.equal(stopped, false);
  release();
  assert.equal(await refresh, false);
  await stopping;
  assert.deepEqual(db.query("SELECT last_online_check_at FROM file_libraries WHERE id = 1").get(), before);
  assert.equal(getAllLibraryStatus()[0]!.isOnline, false);
} finally { release(); fs.promises.opendir = originalOpendir; }
db.close();
console.log("Watcher checks passed");
