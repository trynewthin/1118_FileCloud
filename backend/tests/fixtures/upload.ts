import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import type { AuthUser } from "../../src/core/auth/roles.ts";

// Refuse to load the database without the isolated fixture configuration.
const temp = process.env.FILECLOUD_DATA_DIR;
assert(temp && path.basename(temp).startsWith("filecloud-upload-"));
assert.equal(process.env.FILECLOUD_DB_PATH, path.join(temp, "test.db"));
const { db, initDatabase } = await import("../../src/core/db/index.ts");
const { receiveUpload } = await import("../../src/modules/files/uploadService.ts");
const { renameEntry } = await import("../../src/modules/files/fileOps.ts");
const { handleIndexSingleTask } = await import("../../src/modules/files/indexTasks.ts");
initDatabase();
const allowed = path.join(temp, "allowed");
const root = path.join(allowed, "library");
const sibling = path.join(allowed, "other");
const outside = path.join(temp, "outside");
for (const directory of [root, sibling, outside, path.join(root, "folder")]) {
  fs.mkdirSync(directory, { recursive: true });
}
db.exec("INSERT INTO users(id,username,role) VALUES(1,'alice','user'),(2,'admin','admin'),(3,'revoked','user')");
const admin: AuthUser = { id: 2, username: "admin", role: "admin" };
const library = (id: number, rootPath: string, enabled = 1) =>
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name,is_enabled) VALUES(?,1,?,'Fixture',?)")
    .run(id, rootPath, enabled);
library(1, root);
library(2, sibling);
library(3, path.join(allowed, "disabled"), 0);
library(4, outside);
library(5, path.join(allowed, "new-root"));
const entry = (id: string, libraryId: number, name: string, directory = 1, deleted = 0) =>
  db.prepare("INSERT INTO file_entries(id,library_id,is_directory,original_name,is_deleted) VALUES(?,?,?,?,?)")
    .run(id, libraryId, directory, name, deleted);
entry("parent", 1, "folder");
entry("other-parent", 2, "folder");
entry("file-parent", 1, "file.txt", 0);
entry("deleted-parent", 1, "deleted", 1, 1);
entry("escaped-parent", 1, "escaped");
entry("linked-parent", 1, "linked");
entry("traversal-parent", 1, "..");
fs.symlinkSync(outside, path.join(root, "escaped"), "dir");
fs.symlinkSync(path.join(root, "folder"), path.join(root, "linked"), "dir");
const boundary = "filecloud-upload-test-boundary";
const headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
type FilePart = { name: string; content: string };
const prefix = (file: FilePart) => Buffer.from(
  `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n${file.content}`,
);
const multipart = (files: FilePart[]) => Buffer.concat([
  ...files.flatMap((file) => [prefix(file), Buffer.from("\r\n")]),
  Buffer.from(`--${boundary}--\r\n`),
]);
const upload = (files: FilePart[], parentId: unknown = null, libraryId = 1, user: AuthUser | undefined = admin) =>
  receiveUpload(user, libraryId, parentId, headers, Readable.from([multipart(files)]));
const taskCount = () => (db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number }).count;
const fails = async (operation: () => Promise<unknown>, status = 400) => {
  const before = taskCount();
  await assert.rejects(operation, (error: any) => error.status === status, operation.toString());
  assert.equal(taskCount(), before, "failed uploads must not queue index tasks");
};
const sample = [{ name: "access.txt", content: "must not be written" }];
const originalCreateWriteStream = fs.createWriteStream;
const originalOpen = fs.open;
try {
  await fails(() => receiveUpload(undefined, 1, null, headers, Readable.from([multipart(sample)])), 401);
  await fails(() => upload(sample, null, 1, { id: 1, username: "alice", role: "user" }), 403);
  await fails(() => upload(sample, null, 1, { id: 3, username: "revoked", role: "admin" }), 403);
  await fails(() => upload(sample, null, 1, { id: 999, username: "missing", role: "admin" }), 401);
  await fails(() => upload(sample, null, 0));
  await fails(() => upload(sample, null, 999), 404);
  await fails(() => upload(sample, null, 3), 403);
  await fails(() => upload(sample, null, 4), 403);
  await fails(() => upload(sample, "missing-parent"), 404);
  await fails(() => upload(sample, "deleted-parent"), 404);
  await fails(() => upload(sample, "file-parent"));
  await fails(() => upload(sample, "other-parent"));
  await fails(() => upload(sample, ["parent"]));
  await fails(() => upload(sample, "traversal-parent"), 403);
  await fails(() => upload(sample, "escaped-parent"), 403);
  await fails(() => upload(sample, "linked-parent"), 403);
  assert.equal(fs.existsSync(path.join(root, "access.txt")), false);
  assert.equal(fs.existsSync(path.join(outside, "access.txt")), false);

  const beforeSuccess = taskCount();
  let closed = 0;
  fs.createWriteStream = ((filename, options) => originalCreateWriteStream(filename, {
    ...(typeof options === "object" ? options : {}),
    fs: {
      ...fs,
      close(fd, callback) {
        // Force parser finish to happen well before disk stream close.
        setTimeout(() => {
          assert.equal(taskCount(), beforeSuccess, "indexing started before output close");
          fs.close(fd, (error) => { closed += 1; callback(error); });
        }, 30);
      },
    },
  })) as typeof fs.createWriteStream;
  const first = await upload([
    { name: "你好.txt", content: "unicode filename" },
    { name: "a:b?.txt", content: "sanitized filename" },
  ]);
  fs.createWriteStream = originalCreateWriteStream;
  assert.equal(closed, 2);
  assert.equal(first.uploaded, 2);
  assert.equal(first.task.type, "FILE_INDEX_LIBRARY");
  assert.deepEqual(first.task.payload, { libraryId: 1 });
  assert.equal(first.task.created_by_user_id, 2);
  assert.equal(first.task.status, "PENDING");
  assert.equal(fs.readFileSync(path.join(root, "你好.txt"), "utf8"), "unicode filename");
  assert.equal(fs.readFileSync(path.join(root, "a_b_.txt"), "utf8"), "sanitized filename");

  fs.writeFileSync(path.join(root, "same.txt"), "existing");
  const duplicates = await upload([
    { name: "same.txt", content: "first" },
    { name: "same.txt", content: "second" },
  ]);
  assert.equal(duplicates.uploaded, 2);
  assert.equal(fs.readFileSync(path.join(root, "same.txt"), "utf8"), "existing");
  assert.equal(fs.readFileSync(path.join(root, "same(1).txt"), "utf8"), "first");
  assert.equal(fs.readFileSync(path.join(root, "same(2).txt"), "utf8"), "second");
  let raced = false;
  fs.open = ((filename: any, flags: any, callback: any) => {
    if (filename === path.join(root, "race.txt") && !raced) {
      raced = true;
      assert.equal(flags, "wx", "uploads must reserve paths exclusively");
      fs.writeFileSync(filename, "competing writer", { flag: "wx" });
    }
    return originalOpen(filename, flags, callback);
  }) as typeof fs.open;
  assert.equal((await upload([{ name: "race.txt", content: "our upload" }])).uploaded, 1);
  fs.open = originalOpen;
  assert.equal(raced, true);
  assert.equal(fs.readFileSync(path.join(root, "race.txt"), "utf8"), "competing writer");
  assert.equal(fs.readFileSync(path.join(root, "race(1).txt"), "utf8"), "our upload");
  await Promise.all(["parallel one", "parallel two"].map((content) => upload([{ name: "parallel.txt", content }])));
  assert.deepEqual(new Set(["parallel.txt", "parallel(1).txt"].map((name) => fs.readFileSync(path.join(root, name), "utf8"))),
    new Set(["parallel one", "parallel two"]));
  const nested = await upload([{ name: "nested.txt", content: "nested" }], "parent");
  assert.equal(nested.task.type, "FILE_INDEX_SINGLE");
  assert.deepEqual(nested.task.payload, { libraryId: 1, relativePath: "folder", parentEntryId: "parent" });
  assert.equal(fs.readFileSync(path.join(root, "folder/nested.txt"), "utf8"), "nested");
  assert.equal((await upload([{ name: "empty.txt", content: "" }], null, 5)).uploaded, 1);
  assert.equal(fs.statSync(path.join(allowed, "new-root/empty.txt")).size, 0);

  await fails(() => upload([]));
  await fails(() => receiveUpload(admin, 1, null, {}, Readable.from([multipart(sample)])));
  assert.equal((await upload([{ name: ".", content: "unnamed fallback" }])).uploaded, 1);
  assert.equal(fs.readFileSync(path.join(root, "unnamed"), "utf8"), "unnamed fallback");
  await fails(() => receiveUpload(admin, 1, null, headers, Readable.from([prefix({ name: "truncated.txt", content: "partial" })])));
  assert.equal(fs.existsSync(path.join(root, "truncated.txt")), false);
  await fails(() => upload([
    { name: "rollback.txt", content: "complete file in failed batch" },
    { name: "escaped", content: "invalid symlink destination" },
  ]));
  assert.equal(fs.existsSync(path.join(root, "rollback.txt")), false);

  fs.createWriteStream = ((filename, options) => {
    const output = originalCreateWriteStream(filename, options);
    output._write = (_chunk, _encoding, callback) => {
      setTimeout(() => callback(new Error("simulated disk failure")), 10);
    };
    return output;
  }) as typeof fs.createWriteStream;
  await fails(() => upload([{ name: "disk-failure.txt", content: "partial" }]));
  fs.createWriteStream = originalCreateWriteStream;
  assert.equal(fs.existsSync(path.join(root, "disk-failure.txt")), false);

  for (const failureMode of ["aborted", "error", "close"] as const) {
    const input = new PassThrough();
    const filename = `input-${failureMode}.txt`;
    const before = taskCount();
    const pending = receiveUpload(admin, 1, null, headers, input);
    const rejected = assert.rejects(pending, (error: any) => error.status === 400);
    input.write(prefix({ name: filename, content: "partial" }));
    if (failureMode === "aborted") input.emit("aborted");
    else if (failureMode === "error") input.destroy(new Error("request disconnected"));
    else input.destroy();
    await rejected;
    input.destroy();
    assert.equal(taskCount(), before);
    assert.equal(fs.existsSync(path.join(root, filename)), false);
  }
  // An abort while an exclusive open is pending must wait for its descriptor
  // and remove only the path this request reserved, before rejecting.
  const lateInput = new PassThrough();
  let opened!: () => void;
  const opening = new Promise<void>(resolve => { opened = resolve; });
  fs.open = ((filename: any, flags: any, callback: any) => {
    originalOpen(filename, flags, (error, fd) => {
      opened();
      setTimeout(() => callback(error, fd), 25);
    });
  }) as typeof fs.open;
  const lateBefore = taskCount();
  const lateUpload = receiveUpload(admin, 1, null, headers, lateInput);
  const lateRejected = assert.rejects(lateUpload, (error: any) => error.status === 400);
  lateInput.end(multipart([{ name: "late-open.txt", content: "rollback pending open" }]));
  await opening;
  lateInput.emit("aborted");
  await lateRejected;
  fs.open = originalOpen;
  assert.equal(fs.existsSync(path.join(root, "late-open.txt")), false);
  assert.equal(taskCount(), lateBefore);

  const alreadyClosed = new PassThrough();
  alreadyClosed.destroy();
  await fails(() => receiveUpload(admin, 1, null, headers, alreadyClosed));
  const noBody = new PassThrough();
  const emptyAborted = fails(() => receiveUpload(admin, 1, null, headers, noBody));
  noBody.emit("aborted");
  noBody.destroy();
  await emptyAborted;

  fs.writeFileSync(path.join(outside, "protected.txt"), "protected");
  fs.symlinkSync(path.join(outside, "protected.txt"), path.join(root, "protected.txt"));
  await fails(() => upload([{ name: "protected.txt", content: "overwrite attempt" }]));
  assert.equal(fs.readFileSync(path.join(outside, "protected.txt"), "utf8"), "protected");
  // A parent rename waits for upload completion/rollback. A successful queued
  // index then resolves the stable parent entry at its new path.
  for (const abort of [false, true]) {
    const parentId = abort ? "abort-parent" : "success-parent";
    const oldName = parentId;
    const newName = `${parentId}-moved`;
    entry(parentId, 1, oldName);
    fs.mkdirSync(path.join(root, oldName));
    const input = new PassThrough();
    let started!: () => void;
    let release!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    fs.open = ((filename: any, flags: any, callback: any) => {
      originalOpen(filename, flags, (error, fd) => {
        started();
        void gate.then(() => callback(error, fd));
      });
    }) as typeof fs.open;
    const before = taskCount();
    const pending = receiveUpload(admin, 1, parentId, headers, input);
    const rejection = abort ? assert.rejects(pending, (error: any) => error.status === 400) : undefined;
    input.end(multipart([{ name: "held.txt", content: "held upload" }]));
    await ready;
    let renamed = false;
    const renaming = renameEntry(parentId, newName).then(() => { renamed = true; });
    await Bun.sleep(10);
    assert.equal(renamed, false, "parent relocation must wait for active upload");
    if (abort) input.emit("aborted");
    release();
    if (abort) {
      await rejection;
      await renaming;
      assert.equal(taskCount(), before);
      assert.equal(fs.existsSync(path.join(root, newName, "held.txt")), false);
    } else {
      const result = await pending;
      await renaming;
      assert.equal((result.task.payload as any).parentEntryId, parentId);
      const ctx = { task: result.task, updateProgress() {}, log: { info() {} } } as any;
      await handleIndexSingleTask(ctx);
      assert.equal(fs.readFileSync(path.join(root, newName, "held.txt"), "utf8"), "held upload");
      assert(db.prepare("SELECT id FROM file_entries WHERE parent_id=? AND original_name='held.txt'").get(parentId));
      db.prepare("UPDATE file_entries SET is_deleted=1 WHERE id=?").run(parentId);
      await assert.rejects(handleIndexSingleTask(ctx), /目标目录不存在/);
      db.prepare("UPDATE file_entries SET is_deleted=0, library_id=2 WHERE id=?").run(parentId);
      await assert.rejects(handleIndexSingleTask(ctx), /不属于当前文件库/);
    }
    fs.open = originalOpen;
  }
  console.log("upload regressions passed");
} finally {
  fs.createWriteStream = originalCreateWriteStream;
  fs.open = originalOpen;
  db.close();
}
