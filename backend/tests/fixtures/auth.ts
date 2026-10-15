// Run only in a child process: all database-dependent modules are loaded after
// the isolated path guard. No live server or existing application data is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";

const dataDir = process.env.FILECLOUD_DATA_DIR!;
assert.ok(dataDir?.startsWith(path.join(os.tmpdir(), "filecloud-auth-")));
assert.equal(process.env.FILECLOUD_DB_PATH, path.join(dataDir, "test.db"));
const { db, initDatabase } = await import("../../src/core/db/index.ts");
initDatabase();
const { signUserToken } = await import("../../src/core/auth/jwt.ts");
const { resolveAuthUser, assertLibraryAccess, assertEntryAccess } = await import("../../src/core/auth/libraryAccess.ts");
const { filesRouter } = await import("../../src/modules/files/router.ts");
const { entriesRouter } = await import("../../src/modules/entries/router.ts");
const { fileContentRouter } = await import("../../src/modules/fileContent/router.ts");
const { fileLibrariesRouter } = await import("../../src/modules/fileLibraries/router.ts");
const { executeTool } = await import("../../src/modules/ai/controllers/toolController.ts");
const { authenticate } = await import("../../src/core/auth/permission.ts");
const { fileLibraryToolKit } = await import("../../src/modules/ai/toolkits/fileLibrary.ts");
const { getFileContext } = await import("../../src/modules/ai/smartRename/service.ts");
const { setEntryPassword } = await import("../../src/modules/files/security.ts");

for (const [id, username, role] of [[1, "owner", "user"], [2, "other", "user"], [3, "admin", "admin"], [4, "revoked", "user"]] as const) {
  db.prepare("INSERT INTO users(id, username, role) VALUES (?, ?, ?)").run(id, username, role);
}
for (const [id, owner, enabled] of [[10, 1, 1], [20, 2, 1], [30, 1, 0]]) {
  const root = path.join(dataDir, `library-${id}`);
  fs.mkdirSync(root);
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name,is_enabled) VALUES (?,?,?,?,?)")
    .run(id!, owner!, root, `library-${id}`, enabled!);
}
const insertEntry = (id: string, libraryId: number, name: string, options?: { directory?: boolean; deleted?: boolean; parent?: string }) => {
  db.prepare("INSERT INTO file_entries(id, library_id, original_name, parent_id, is_directory, extension, mime_type, is_deleted) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, libraryId, name, options?.parent ?? null, options?.directory ? 1 : 0, options?.directory ? null : "txt", "text/plain", options?.deleted ? 1 : 0);
  if (!options?.deleted) {
    db.prepare("INSERT INTO file_index_fts(file_id,library_id,name,path,extension) VALUES(?,?,?,?,?)")
      .run(id, String(libraryId), name, `/${name}`, "txt");
  }
  const filePath = path.join(dataDir, `library-${libraryId}`, name);
  if (options?.directory) fs.mkdirSync(filePath);
  else fs.writeFileSync(filePath, `content:${id}`);
};
insertEntry("own", 10, "sample-own.txt");
insertEntry("foreign", 20, "sample-foreign.txt");
insertEntry("disabled", 30, "sample-disabled.txt");
insertEntry("deleted", 10, "sample-deleted.txt", { deleted: true });
insertEntry("own-dir", 10, "own-dir", { directory: true });
insertEntry("foreign-dir", 20, "foreign-dir", { directory: true });
insertEntry("locked", 10, "locked.txt");
setEntryPassword("locked", "fixture-password");

const token = (id: number, role: "user" | "admin" = "user") => signUserToken({ id, role, username: "fixture" });
const ownerToken = token(1);
const adminToken = token(3, "admin");
const staleAdminToken = token(1, "admin");
const deletedUserToken = token(4);
db.prepare("DELETE FROM users WHERE id = 4").run();

assert.equal(resolveAuthUser(1).role, "user");
assert.throws(() => resolveAuthUser(4), /会话已失效/);
assert.equal((await assertLibraryAccess(resolveAuthUser(1), 10)).user_id, 1);
await assert.rejects(async () => (await assertLibraryAccess(resolveAuthUser(1), 20)), /无权访问/);
assert.equal((await assertLibraryAccess(resolveAuthUser(3), 20)).id, 20);
await assert.rejects(async () => (await assertEntryAccess(resolveAuthUser(1), "foreign")), /无权访问/);
await assert.rejects(async () => (await assertEntryAccess(resolveAuthUser(3), "own-dir", { libraryId: 20 })), /不属于/);

const app = express();
app.use(express.json());
app.use("/files", filesRouter);
app.use("/entries", entriesRouter);
app.use("/content", fileContentRouter);
app.use("/libraries", fileLibrariesRouter);
app.post("/ai/execute", authenticate, executeTool);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const request = async (url: string, auth = ownerToken, body?: unknown, method = body === undefined ? "GET" : "POST") => {
  const response = await fetch(base + url, { method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
};
const expectStatus = async (url: string, expected: number, auth = ownerToken, body?: unknown, method?: string) => {
  const result = await request(url, auth, body, method);
  assert.equal(result.status, expected, `${url}: ${JSON.stringify(result.data)}`);
  return result.data;
};
try {
  await expectStatus("/files/library/10/entries", 200);
  await expectStatus("/files/library/20/entries", 404);
  await expectStatus("/files/library/30/entries", 403);
  await expectStatus("/files/library/999/entries", 404);
  await expectStatus("/files/library/10/entries?parentId=foreign-dir", 404);
  await expectStatus("/files/library/10/entries?parentId=foreign-dir", 400, adminToken);
  await expectStatus("/files/library/20/search?q=sample", 404);
  await expectStatus("/files/library/20/folders/search?keyword=foreign", 404);
  for (const suffix of ["", "/download", "/download/filename.txt"]) {
    await expectStatus(`/files/entries/foreign${suffix}`, 404);
    await expectStatus(`/files/entries/disabled${suffix}`, 403);
    await expectStatus(`/files/entries/deleted${suffix}`, 404);
  }
  assert.equal(await expectStatus("/files/entries/own/download", 200), "content:own");
  await expectStatus("/files/entries/foreign", 200, adminToken);
  await expectStatus("/files/entries/own", 401, deletedUserToken);
  await expectStatus("/files/entries/own/rename", 403, staleAdminToken, { newName: "name" });
  for (const suffix of ["stream", "thumbnail", "transcode", "stream/transcoded"]) {
    await expectStatus(`/content/foreign/${suffix}`, 404);
    await expectStatus(`/content/disabled/${suffix}`, 403);
    await expectStatus(`/content/deleted/${suffix}`, 404);
    await expectStatus(`/content/locked/${suffix}`, 403);
  }
  await expectStatus("/content/foreign/transcode", 404, ownerToken, {});
  await expectStatus("/content/locked/transcode", 403, ownerToken, {});
  await expectStatus("/content/own/stream", 200);
  await expectStatus("/content/locked/stream?password=fixture-password", 200);
  await expectStatus("/libraries/20/stats", 404);
  await expectStatus("/libraries/10/stats", 200);
  await expectStatus("/libraries/20/stats", 200, adminToken);
  const list = await expectStatus("/entries", 200);
  assert.ok(list.items.length > 0);
  assert.ok(list.items.every((entry: any) => entry.library_id === 10));
  assert.equal(list.pagination.total, list.items.length);
  assert.equal((await expectStatus("/entries?libraryIds=20", 200)).items.length, 0);
  await expectStatus("/entries?parentId=foreign-dir", 404);
  const search = await expectStatus("/entries/search?q=sample", 200);
  assert.deepEqual(search.items.map((entry: any) => entry.id), ["own"]);
  const status = await expectStatus("/entries/libraries/status", 200);
  assert.ok(status.libraries.every((library: any) => library.id !== 20));

  const context = (userId = 1) => ({ userId, conversationId: 1, conversationVars: {} });
  const runTool = (name: string, args: Record<string, unknown>, userId = 1) => fileLibraryToolKit.tools.find((tool) => tool.name === name)!.executor(args, context(userId));
  const libraries = await runTool("list_libraries", {});
  assert.equal(libraries.success, true);
  assert.deepEqual(libraries.result.libraries.map((library: any) => library.id), [10]);
  assert.equal((await runTool("list_libraries", {}, 4)).success, false);
  assert.equal((await runTool("list_directory", { library_id: 10 })).success, true);
  assert.equal((await runTool("list_directory", { library_id: 20 })).success, false);
  assert.equal((await runTool("list_directory", { library_id: 30 })).success, false);
  assert.equal((await runTool("list_directory", { library_id: 10, parent_id: "foreign-dir" }, 3)).success, false);
  for (const fileId of ["foreign", "disabled", "deleted", "locked"]) {
    assert.equal((await runTool("get_file_info", { file_id: fileId })).success, false, fileId);
    assert.equal((await runTool("show_files", { file_ids: ["own", fileId] })).success, false, fileId);
  }
  assert.equal((await runTool("get_file_info", { file_id: "foreign" }, 3)).success, true);
  const aiSearch = await runTool("search_files", { keyword: "sample" });
  assert.deepEqual(aiSearch.result.results.map((entry: any) => entry.id), ["own"]);
  assert.equal((await runTool("search_files", { library_id: 20, keyword: "sample" })).success, false);
  assert.equal((await runTool("rename_file", { file_id: "own", new_name: "renamed" })).success, false);
  assert.equal((await runTool("rename_file", { file_id: "own", new_name: "renamed" }, 3)).success, true);
  assert.equal((await runTool("move_file", { file_id: "own", target_parent_id: "foreign-dir" }, 3)).success, false);
  await assert.rejects(async () => (await getFileContext("foreign", 1)), /无权访问/);
  await assert.rejects(async () => (await getFileContext("locked", 1)), /密码/);
  assert.equal((await getFileContext("own", 1)).isRoot, true);

  const countTasks = () => (db.prepare("SELECT COUNT(*) AS count FROM tasks").get() as { count: number }).count;
  const before = countTasks();
  for (const toolName of ["rename_file", "move_file", "delete_file"]) {
    await expectStatus("/ai/execute", 403, ownerToken, { toolName, args: { file_id: "own", new_name: "renamed" } });
  }
  await expectStatus("/ai/execute", 400, adminToken, { toolName: "move_file", args: { file_id: "own", target_parent_id: "foreign-dir" } });
  await expectStatus("/ai/execute", 403, adminToken, { toolName: "delete_file", args: { file_id: "locked" } });
  await expectStatus("/ai/execute", 403, adminToken, { toolName: "delete_file", args: { file_id: "disabled" } });
  await expectStatus("/ai/execute", 404, adminToken, { toolName: "delete_file", args: { file_id: "deleted" } });
  assert.equal(countTasks(), before, "Denied AI calls must not enqueue work");
  await expectStatus("/ai/execute", 200, adminToken, { toolName: "rename_file", args: { file_id: "own", new_name: "renamed" } });
  assert.equal(countTasks(), before + 1);
  // Historical overlapping ownership must not make an indexed foreign subtree
  // visible through a library that happens to carry the caller's user ID.
  const overlapRoot = path.join(dataDir, "library-20", "foreign-dir");
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name) VALUES(40,1,?,?)").run(overlapRoot, "legacy-overlap");
  db.prepare("INSERT INTO file_entries(id,library_id,original_name,is_directory) VALUES('overlap',40,'sample-overlap.txt',0)").run();
  db.prepare("INSERT INTO file_index_fts(file_id,library_id,name,path,extension) VALUES('overlap','40','sample-overlap.txt','/sample-overlap.txt','txt')").run();
  await expectStatus("/files/library/40/entries", 403);
  await expectStatus("/files/entries/overlap", 403);
  const overlapList = await expectStatus("/entries", 200);
  assert.ok(overlapList.items.every((entry: any) => entry.library_id === 10));
  assert.equal(overlapList.pagination.total, overlapList.items.length);
  assert.deepEqual((await expectStatus("/entries/search?q=sample", 200)).items.map((entry: any) => entry.id), ["own"]);
  assert.deepEqual((await runTool("list_libraries", {})).result.libraries.map((library: any) => library.id), [10]);
  assert.equal((await runTool("get_file_info", { file_id: "overlap" })).success, false);
  assert.deepEqual((await runTool("search_files", { keyword: "sample" })).result.results.map((entry: any) => entry.id), ["own"]);
  assert.equal((await runTool("get_file_info", { file_id: "overlap" }, 3)).success, true);
  // Owners can still disable/remove unsafe legacy configuration without ever
  // opening its filesystem. Content and refresh remain denied.
  await expectStatus("/libraries/40", 404, token(2), undefined, "DELETE");
  await expectStatus("/libraries/40", 200, ownerToken, { isEnabled: false }, "PATCH");
  await expectStatus("/libraries/40", 204, ownerToken, undefined, "DELETE");
  assert.equal(fs.readFileSync(path.join(dataDir, "library-20", "sample-foreign.txt"), "utf8"), "content:foreign");
  const deniedRoot = path.join(path.dirname(dataDir), "outside-filecloud-auth-fixture");
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name) VALUES(50,1,?,'disallowed-root')").run(deniedRoot);
  await expectStatus("/libraries/50/stats", 403);
  await expectStatus("/libraries/50/refresh", 403, ownerToken, {});
  await expectStatus("/libraries/50", 200, ownerToken, { isEnabled: false }, "PATCH");
  await expectStatus("/libraries/50", 204, ownerToken, undefined, "DELETE");
  console.log("Authorization regression checks passed");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
}
