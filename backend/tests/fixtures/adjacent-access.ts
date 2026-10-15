import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { db, initDatabase } from "../../src/core/db/index.ts";
import { signUserToken } from "../../src/core/auth/jwt.ts";
import { tagsRouter } from "../../src/modules/tags/router.ts";
import { tasksRouter } from "../../src/modules/tasks/router.ts";
import { handleIndexLibraryTask, handleIndexSingleTask } from "../../src/modules/files/indexTasks.ts";
import { isLibraryOnline } from "../../src/modules/coreServices/libraryWatcher.ts";
import type { TaskContext, TaskRecord } from "../../src/core/tasks/types.ts";

initDatabase();
const temp = process.env.FILECLOUD_DATA_DIR!;
const allowed = path.join(temp, "allowed");
const root = path.join(allowed, "library");
const sibling = path.join(allowed, "library-other");
const outside = path.join(temp, "outside");
for (const directory of [root, sibling, outside]) fs.mkdirSync(directory, { recursive: true });
db.exec("INSERT INTO users(id, username, role) VALUES(1,'alice','user'),(2,'bob','user'),(3,'admin','admin')");
const library = (id: number, userId: number, rootPath: string, enabled = 1) =>
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name,is_enabled) VALUES(?,?,?,? ,?)")
    .run(id, userId, rootPath, `Library ${id}`, enabled);
library(1, 1, root);
library(2, 2, sibling);
library(3, 1, path.join(allowed, "disabled"), 0);
library(4, 1, outside);
const entry = (id: string, libraryId: number, name: string, deleted = 0) =>
  db.prepare("INSERT INTO file_entries(id,library_id,is_directory,original_name,is_deleted) VALUES(?,?,0,?,?)")
    .run(id, libraryId, name, deleted);
entry("own", 1, "own.txt");
entry("other", 2, "secret.txt");
entry("disabled", 3, "disabled.txt");
entry("deleted", 1, "deleted.txt", 1);
db.exec(`INSERT INTO file_tags(id,user_id,name,level) VALUES
  (1,1,'Alice tag',1),(2,2,'Bob private tag',1),(3,3,'Admin tag',1),(4,1,'New tag',1);
  INSERT INTO file_tag_entries(tag_id,entry_id,is_primary) VALUES
  (1,'own',1),(2,'own',1),(1,'other',0),(1,'disabled',0),(1,'deleted',0),(3,'own',1)`);

const app = express();
app.use(express.json());
app.use("/tags", tagsRouter);
app.use("/tasks", tasksRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const tokens = ["", ...[
  { id: 1, username: "alice", role: "user" as const },
  { id: 2, username: "bob", role: "user" as const },
  { id: 3, username: "admin", role: "admin" as const },
].map(signUserToken)];
const request = async (url: string, userId = 1, method = "GET", body?: unknown) => {
  const response = await fetch(`http://127.0.0.1:${address.port}${url}`, {
    method,
    headers: { authorization: `Bearer ${tokens[userId]}`, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() as any };
};
const primary = (tagId: number) => (db.prepare("SELECT is_primary FROM file_tag_entries WHERE tag_id=? AND entry_id='own'").get(tagId) as {is_primary:number}).is_primary;
try {
  let response = await request("/tags/entry/own");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.tags.map((association: any) => association.tag_id), [1]);
  assert.equal((await request("/tags/entry/other")).status, 404);
  assert.equal((await request("/tags/entry/disabled")).status, 403);
  assert.equal((await request("/tags/entry/deleted")).status, 404);
  assert.equal((await request("/tags/2/entries")).status, 404);
  assert.deepEqual((await request("/tags/1/entries")).body.entryIds, ["own"]);
  assert.equal((await request("/tags")).body.tags.find((tag: any) => tag.id === 1).entry_count, 1);
  for (const action of ["add", "remove", "primary"]) {
    assert.equal((await request(`/tags/entry/own/${action}`, 1, "POST", { tagId: 2 })).status, 404);
    assert.equal((await request(`/tags/entry/other/${action}`, 1, "POST", { tagId: 1 })).status, 404);
  }
  assert.equal((await request("/tags/entry/own/add", 1, "POST", { tagId: 1.5 })).status, 400);
  assert.equal((await request("/tags/4/batch-add", 1, "POST", { entryIds: ["own", "other"] })).status, 404);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM file_tag_entries WHERE tag_id=4").get() as {count:number}).count, 0);
  assert.equal((await request("/tags/1/batch-remove", 1, "POST", { entryIds: ["own", "other"] })).status, 404);
  assert.equal(primary(1), 1);
  assert.equal((await request("/tags/1/batch-add", 1, "POST", { entryIds: [3] })).status, 400);
  assert.equal((await request("/tags/entry/own/primary", 1, "DELETE")).status, 204);
  assert.equal(primary(1), 0);
  assert.equal(primary(2), 1);
  assert.equal(primary(3), 1);
  assert.equal((await request("/tags/entry/own/primary", 1, "POST", { tagId: 1 })).status, 204);
  assert.equal(primary(1), 1);
  assert.equal(primary(2), 1);
  assert.equal(primary(3), 1);
  assert.equal((await request("/tags/entry/own/add", 1, "POST", { tagId: 4, isPrimary: true })).status, 201);
  assert.equal(primary(1), 0);
  assert.equal(primary(4), 1);
  assert.equal(primary(3), 1);
  assert.equal((await request("/tags/entry/other/add", 3, "POST", { tagId: 3 })).status, 201);

  const task = (id: number, creator: number | null, payload: object, parent: number | null = null) =>
    db.prepare("INSERT INTO tasks(id,parent_task_id,type,payload,status,created_by_user_id) VALUES(?,?,'FILE_INDEX_LIBRARY',?,'SUCCESS',?)")
      .run(id, parent, JSON.stringify(payload), creator);
  task(1, 1, { libraryId: 1 });
  task(2, 2, { libraryId: 2, libraryName: "Bob private library" });
  task(3, null, { libraryId: 1 });
  task(4, 1, { libraryId: 2 });
  task(5, 1, { entryId: "other" });
  task(6, 1, { libraryId: 3 });
  task(7, 2, { libraryId: 2 }, 1);
  task(8, 1, { libraryId: 1 }, 1);
  task(9, 1, { entryId: "deleted" });
  response = await request("/tasks?includeChildren=true");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items.map((item: any) => item.id).sort(), [1, 9]);
  assert.deepEqual(response.body.items.find((item: any) => item.id === 1).children.map((child: any) => child.id), [8]);
  assert.deepEqual((await request("/tasks/1")).body.task.children.map((child: any) => child.id), [8]);
  for (const id of [2, 3, 4, 5, 6, 7]) assert.equal((await request(`/tasks/${id}`)).status, 404);
  assert.equal((await request("/tasks/2", 3)).status, 200);
  assert.equal((await request("/tasks", 3)).body.items.length, 7);
  assert.equal((await request("/tasks?limit=-1")).status, 400);
  assert.equal((await request("/tasks?offset=1.5")).status, 400);

  const context = (payload: object): TaskContext => ({
    task: { payload } as TaskRecord,
    updateProgress() {}, updateDetailProgress() {},
    log: { debug() {}, info() {}, warn() {}, error() {} },
    isCancelled: () => false,
    createChildTask: () => { throw new Error("Unexpected child task"); },
  });
  fs.writeFileSync(path.join(sibling, "secret.txt"), "private sibling data");
  fs.writeFileSync(path.join(outside, "external.txt"), "private outside data");
  fs.symlinkSync(sibling, path.join(root, "escaped"), "dir");
  fs.symlinkSync(path.join(sibling, "secret.txt"), path.join(root, "linked.txt"));
  await assert.rejects(handleIndexSingleTask(context({ libraryId: 1, relativePath: "../library-other/secret.txt" })));
  await assert.rejects(handleIndexSingleTask(context({ libraryId: 1, relativePath: "escaped/secret.txt" })));
  await assert.rejects(handleIndexSingleTask(context({ libraryId: 1, relativePath: "linked.txt" })));
  await assert.rejects(handleIndexSingleTask(context({ libraryId: 1, relativePath: path.join(root, "own.txt") })));
  await assert.rejects(handleIndexSingleTask(context({ libraryId: 1, relativePath: ".filecloud_meta" })));
  fs.mkdirSync(path.join(root, "folder"));
  fs.writeFileSync(path.join(root, "folder/nested.txt"), "nested");
  await handleIndexSingleTask(context({ libraryId: 1, relativePath: "folder/../folder/nested.txt" }));
  const nested = db.prepare("SELECT fe.parent_id, p.original_name AS parent_name FROM file_entries fe JOIN file_entries p ON p.id=fe.parent_id WHERE fe.library_id=1 AND fe.original_name='nested.txt'").get() as {parent_id:string;parent_name:string};
  assert.equal(nested.parent_name, "folder");
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM file_entries WHERE original_name IN ('.','..','secret.txt') AND library_id=1").get() as {count:number}).count, 0);
  await handleIndexLibraryTask(context({ libraryId: 1 }));
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM file_entries WHERE original_name IN ('escaped','linked.txt','secret.txt') AND library_id=1").get() as {count:number}).count, 0);
  assert.equal((await isLibraryOnline(1)), true);
  assert.equal((await isLibraryOnline(4)), false);
  entry("outside-entry", 4, "external.txt");
  await assert.rejects(handleIndexLibraryTask(context({ libraryId: 4, forceReindex: true })));
  assert.equal((db.prepare("SELECT is_deleted FROM file_entries WHERE id='outside-entry'").get() as {is_deleted:number}).is_deleted, 0);
  console.log("adjacent access regressions passed");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
    server.closeAllConnections();
  });
  db.close();
}
