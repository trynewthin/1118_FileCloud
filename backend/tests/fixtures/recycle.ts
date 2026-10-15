import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { db, initDatabase } from "../../src/core/db/index.ts";
import { moveEntryToTrash, restoreEntryFromTrash, permanentlyDeleteEntry, renameEntry, moveEntry, copyEntry } from "../../src/modules/files/fileOps.ts";

import { listDeletedEntriesByLibrary } from "../../src/modules/files/service.ts";

import { handleDeleteEntryTask } from "../../src/modules/files/fileOpsTasks.ts";

initDatabase();
const root = path.join(process.env.FILECLOUD_DATA_DIR!, "library");
fs.mkdirSync(root);
db.prepare("INSERT INTO users(id,username,role) VALUES(1,'fixture','admin')").run();
db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name) VALUES(1,1,?,'fixture')").run(root);
const add = (id: string, name: string, parent: string | null = null, directory = false) => {
  db.prepare("INSERT INTO file_entries(id,library_id,parent_id,is_directory,original_name) VALUES(?,1,?,?,?)").run(id, parent, Number(directory), name);
};
const deleted = (id: string) => (db.prepare("SELECT is_deleted FROM file_entries WHERE id=?").get(id) as {is_deleted:number}).is_deleted;
add("first", "same.txt");
fs.writeFileSync(path.join(root, "same.txt"), "first content");
(await moveEntryToTrash("first"));
add("second", "same.txt");
fs.writeFileSync(path.join(root, "same.txt"), "second content");
await assert.rejects(async () => (await restoreEntryFromTrash("first")), /同名/);
assert.equal(fs.readFileSync(path.join(root, "same.txt"), "utf8"), "second content");
assert.equal(deleted("first"), 1);
(await moveEntryToTrash("second"));
assert.deepEqual(new Set((await listDeletedEntriesByLibrary(1)).map((entry) => entry.id)), new Set(["first", "second"]));
(await restoreEntryFromTrash("first"));
assert.equal(fs.readFileSync(path.join(root, "same.txt"), "utf8"), "first content");
fs.renameSync(path.join(root, "same.txt"), path.join(root, "first-recovered.txt"));
(await restoreEntryFromTrash("second"));
assert.equal(fs.readFileSync(path.join(root, "same.txt"), "utf8"), "second content");

add("folder", "folder", null, true);
add("early", "early.txt", "folder");
add("with-folder", "present.txt", "folder");
fs.mkdirSync(path.join(root, "folder"));
fs.writeFileSync(path.join(root, "folder/early.txt"), "early");
fs.writeFileSync(path.join(root, "folder/present.txt"), "present");
(await moveEntryToTrash("early"));
(await moveEntryToTrash("folder"));
await assert.rejects(async () => (await restoreEntryFromTrash("with-folder")), /父目录/);
fs.mkdirSync(path.join(root, "folder"));
fs.writeFileSync(path.join(root, "folder/existing.txt"), "keep me");
await assert.rejects(async () => (await restoreEntryFromTrash("folder")), /同名/);
assert.equal(fs.readFileSync(path.join(root, "folder/existing.txt"), "utf8"), "keep me");
assert.equal(deleted("folder"), 1);
fs.renameSync(path.join(root, "folder"), path.join(root, "existing-folder"));
(await restoreEntryFromTrash("folder"));
assert.equal(deleted("early"), 1);
assert.equal(deleted("with-folder"), 0);
assert.equal(fs.readFileSync(path.join(root, "folder/present.txt"), "utf8"), "present");
(await restoreEntryFromTrash("early"));
assert.equal(fs.readFileSync(path.join(root, "folder/early.txt"), "utf8"), "early");

(await moveEntryToTrash("second"));
(await permanentlyDeleteEntry("second"));
await assert.rejects(async () => (await restoreEntryFromTrash("second")), /源文件不存在/);
assert.equal(deleted("second"), 1);
add("missing", "missing.txt");
await assert.rejects(async () => (await moveEntryToTrash("missing")), /源文件不存在/);
assert.equal(deleted("missing"), 0);
await assert.rejects(async () => (await renameEntry("early", "../../escape")), /不合法/);
await assert.rejects(async () => (await copyEntry("early", null, "../escape")), /不合法/);
await assert.rejects(async () => (await moveEntry("folder", "folder")), /自身/);

// Symlink mutation must never operate on a different indexed file.
add("alias", "alias.txt");
fs.symlinkSync("first-recovered.txt", path.join(root, "alias.txt"));
await assert.rejects(async () => (await moveEntryToTrash("alias")));
await assert.rejects(async () => (await renameEntry("alias", "changed.txt")));
assert.equal(fs.readFileSync(path.join(root, "first-recovered.txt"), "utf8"), "first content");
assert.equal(fs.lstatSync(path.join(root, "alias.txt")).isSymbolicLink(), true);
assert.equal(deleted("alias"), 0);

add("linked-dir", "linked-dir", null, true);
fs.mkdirSync(path.join(root, "linked-dir"));
fs.symlinkSync("../first-recovered.txt", path.join(root, "linked-dir/link.txt"));
await assert.rejects(async () => (await moveEntryToTrash("linked-dir")));
assert.equal(fs.existsSync(path.join(root, "linked-dir/link.txt")), true);
assert.equal(deleted("linked-dir"), 0);

// Existing pre-migration trash paths remain recoverable.
add("legacy", "legacy.txt");
db.prepare("UPDATE file_entries SET is_deleted=1 WHERE id='legacy'").run();
fs.mkdirSync(path.join(root, ".filecloud_meta/trash"), {recursive:true});
fs.writeFileSync(path.join(root, ".filecloud_meta/trash/legacy.txt"), "legacy");
(await restoreEntryFromTrash("legacy"));
assert.equal(fs.readFileSync(path.join(root, "legacy.txt"), "utf8"), "legacy");
// A mapping write failure must happen before any active data is removed.
add("db-failure", "db-failure.txt");
fs.writeFileSync(path.join(root, "db-failure.txt"), "preserve on database failure");
db.exec("CREATE TRIGGER reject_trash_location BEFORE INSERT ON file_trash_locations BEGIN SELECT RAISE(ABORT, 'injected location failure'); END");
await assert.rejects(async () => (await moveEntryToTrash("db-failure")), /injected location failure/);
assert.equal(fs.readFileSync(path.join(root, "db-failure.txt"), "utf8"), "preserve on database failure");
assert.equal(deleted("db-failure"), 0);
db.exec("DROP TRIGGER reject_trash_location");
// Failure after the physical move is compensated and the DB transaction rolls back.
db.exec("CREATE TRIGGER reject_trash_state BEFORE UPDATE OF is_deleted ON file_entries BEGIN SELECT RAISE(ABORT, 'injected state failure'); END");
await assert.rejects(async () => (await moveEntryToTrash("db-failure")), /injected state failure/);
assert.equal(fs.readFileSync(path.join(root, "db-failure.txt"), "utf8"), "preserve on database failure");
assert.equal(deleted("db-failure"), 0);
db.exec("DROP TRIGGER reject_trash_state");
(await moveEntryToTrash("db-failure"));
db.exec("CREATE TRIGGER reject_restore_state BEFORE UPDATE OF is_deleted ON file_entries BEGIN SELECT RAISE(ABORT, 'injected restore failure'); END");
await assert.rejects(async () => (await restoreEntryFromTrash("db-failure")), /injected restore failure/);
assert.equal(fs.existsSync(path.join(root, "db-failure.txt")), false);
assert.equal(deleted("db-failure"), 1);
assert.ok((await listDeletedEntriesByLibrary(1)).some((entry) => entry.id === "db-failure"));
db.exec("DROP TRIGGER reject_restore_state");
(await restoreEntryFromTrash("db-failure"));
assert.equal(fs.readFileSync(path.join(root, "db-failure.txt"), "utf8"), "preserve on database failure");

// Retrying an interrupted deletion must not overwrite its durable recovery map.
(await moveEntryToTrash("db-failure"));
const savedLocation = db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id='db-failure'").get() as {relative_path:string};
db.prepare("UPDATE file_entries SET is_deleted=0 WHERE id='db-failure'").run();
await assert.rejects(async () => (await moveEntryToTrash("db-failure")), /源文件不存在/);
assert.deepEqual(db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id='db-failure'").get(), savedLocation);
assert.equal(fs.readFileSync(path.join(root, savedLocation.relative_path), "utf8"), "preserve on database failure");
fs.writeFileSync(path.join(root, "db-failure.txt"), "new active copy");
await assert.rejects(async () => (await moveEntryToTrash("db-failure")), /未完成/);
assert.deepEqual(db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id='db-failure'").get(), savedLocation);
assert.equal(fs.readFileSync(path.join(root, "db-failure.txt"), "utf8"), "new active copy");

// Deleting an ancestor must preserve an interrupted child's recovery location.
add("pending-parent", "pending-parent", null, true);
add("pending-child", "child.txt", "pending-parent");
fs.mkdirSync(path.join(root, "pending-parent"));
fs.writeFileSync(path.join(root, "pending-parent/child.txt"), "pending child");
(await moveEntryToTrash("pending-child"));
const childRecovery = db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id='pending-child'").get() as {relative_path:string};
db.prepare("UPDATE file_entries SET is_deleted=0 WHERE id='pending-child'").run();
await assert.rejects(async () => (await moveEntryToTrash("pending-parent")), /未完成/);
assert.deepEqual(db.prepare("SELECT relative_path FROM file_trash_locations WHERE entry_id='pending-child'").get(), childRecovery);
assert.equal(fs.readFileSync(path.join(root, childRecovery.relative_path), "utf8"), "pending child");
assert.equal(deleted("pending-parent"), 0);

// Permanently destroyed children stay deleted when their container is restored.
add("destroy-parent", "destroy-parent", null, true);
add("destroy-child", "child.txt", "destroy-parent");
fs.mkdirSync(path.join(root, "destroy-parent"));
fs.writeFileSync(path.join(root, "destroy-parent/child.txt"), "delete permanently");
(await moveEntryToTrash("destroy-parent"));
(await permanentlyDeleteEntry("destroy-child"));
(await restoreEntryFromTrash("destroy-parent"));
assert.equal(deleted("destroy-child"), 1);
assert.equal(fs.existsSync(path.join(root, "destroy-parent/child.txt")), false);

// Concurrent requests must serialize one library's recovery-map transitions.
add("parallel", "parallel.txt");
fs.writeFileSync(path.join(root, "parallel.txt"), "preserve concurrent deletion");
const parallelDeletes = await Promise.allSettled([moveEntryToTrash("parallel"), moveEntryToTrash("parallel")]);
assert.equal(parallelDeletes.filter(result => result.status === "fulfilled").length, 1);
assert.equal(parallelDeletes.filter(result => result.status === "rejected").length, 1);
await restoreEntryFromTrash("parallel");
assert.equal(fs.readFileSync(path.join(root, "parallel.txt"), "utf8"), "preserve concurrent deletion");

// Authority is rechecked when a queued mutation executes, not just on enqueue.
db.prepare("UPDATE users SET role='user' WHERE id=1").run();
await assert.rejects(handleDeleteEntryTask({ task: { created_by_user_id: 1, payload: { entryId: "legacy" } }, log: { info() {} } } as any), /权限不足/);
assert.equal(fs.readFileSync(path.join(root, "legacy.txt"), "utf8"), "legacy");
assert.equal(deleted("legacy"), 0);
db.close();
console.log("recycle regressions passed");
