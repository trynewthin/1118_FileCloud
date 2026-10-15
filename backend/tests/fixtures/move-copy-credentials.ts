import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { AuthUser } from "../../src/core/auth/roles.ts";

const temp = process.env.FILECLOUD_DATA_DIR!;
assert(temp?.startsWith(path.join(os.tmpdir(), "filecloud-transfer-credentials-")));
assert.equal(process.env.FILECLOUD_DB_PATH, path.join(temp, "test.db"));
const { db, initDatabase } = await import("../../src/core/db/index.ts");
const { submitEntryCommand } = await import("../../src/modules/files/application.ts");
const { setEntryPassword } = await import("../../src/modules/files/security.ts");
const { signUserToken } = await import("../../src/core/auth/jwt.ts");
const { filesRouter } = await import("../../src/modules/files/router.ts");
initDatabase();

db.exec("INSERT INTO users(id,username,role) VALUES(1,'owner','user'),(2,'foreign','user'),(3,'admin','admin'),(4,'demoted','user')");
const admin: AuthUser = { id: 3, username: "admin", role: "admin" };
const owner: AuthUser = { id: 1, username: "owner", role: "user" };
const foreign: AuthUser = { id: 2, username: "foreign", role: "user" };
const demoted: AuthUser = { id: 4, username: "demoted", role: "admin" };
for (const [id, ownerId, enabled] of [[1, 1, 1], [2, 2, 1], [3, 1, 0]] as const) {
  const root = path.join(temp, `library-${id}`);
  fs.mkdirSync(root);
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name,is_enabled) VALUES(?,?,?,?,?)")
    .run(id, ownerId, root, `Library ${id}`, enabled);
}
function entry(id: string, directory = false, library = 1, deleted = false, parent: string | null = null) {
  db.prepare("INSERT INTO file_entries(id,library_id,original_name,is_directory,is_deleted,parent_id) VALUES(?,?,?,?,?,?)")
    .run(id, library, id, Number(directory), Number(deleted), parent);
  const name = path.join(temp, `library-${library}`, parent ?? "", id);
  if (directory) fs.mkdirSync(name); else fs.writeFileSync(name, id);
}
entry("source"); entry("target", true); entry("plain"); entry("open-target", true);
entry("same-target", true); entry("foreign-target", true, 2); entry("foreign-source", false, 2);
entry("disabled-source", false, 3); entry("disabled-target", true, 3); entry("deleted-target", true, 1, true);
entry("nested", true, 1, false, "target");
setEntryPassword("source", "source-secret"); setEntryPassword("target", "target-secret");
setEntryPassword("same-target", "source-secret"); setEntryPassword("foreign-target", "foreign-secret");
setEntryPassword("foreign-source", "foreign-source-secret");
const countTasks = () => (db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as { n: number }).n;

for (const command of ["move", "copy"] as const) {
  const valid = { targetParentId: "target", sourcePassword: "source-secret", targetPassword: "target-secret" };
  async function denied(input: unknown, status: number, actor: AuthUser | undefined = admin, id = "source") {
    const before = countTasks();
    await assert.rejects(async () => { await submitEntryCommand(actor, id, command, input); }, (error: any) => error.status === status);
    assert.equal(countTasks(), before, "rejected requests must not enqueue tasks");
  }
  await denied(valid, 401, { ...admin, id: 999 });
  for (const actor of [owner, foreign, demoted]) {
    await denied(valid, 403, actor);
    await denied({ ...valid, targetParentId: "foreign-target", targetPassword: "foreign-secret" }, 403, actor);
  }
  await denied({ ...valid, targetParentId: "foreign-target", targetPassword: "foreign-secret" }, 400);
  await denied(valid, 403, admin, "disabled-source");
  await denied({ ...valid, targetParentId: "disabled-target" }, 403);
  await denied({ ...valid, targetParentId: "deleted-target" }, 404);
  await denied({ ...valid, targetParentId: "plain" }, 400);
  await denied({ ...valid, targetParentId: "missing" }, 404);
  await denied({ ...valid, sourcePassword: undefined }, 403);
  await denied({ ...valid, targetPassword: undefined }, 403);
  await denied({ ...valid, sourcePassword: "target-secret", targetPassword: "source-secret" }, 403);
  // A correct target/legacy credential never substitutes for a wrong source,
  // and explicit empty/null credentials suppress legacy fallback per endpoint.
  for (const field of ["sourcePassword", "targetPassword"] as const) {
    for (const value of ["wrong", "", null]) {
      await denied({ targetParentId: "same-target", password: "source-secret", [field]: value }, 403);
    }
    for (const value of [1, true, [], {}]) await denied({ ...valid, [field]: value }, 400);
  }
  await denied({ ...valid, password: {} }, 400);
  await denied({ ...valid, targetParentId: "" }, 400);
  for (const [id, input] of [
    ["source", valid],
    ["source", { ...valid, password: "obsolete-wrong-secret" }],
    ["source", { targetParentId: "same-target", password: "source-secret" }],
    ["source", { targetParentId: "target", password: "source-secret", targetPassword: "target-secret" }],
    ["source", { targetParentId: "target", password: "target-secret", sourcePassword: "source-secret" }],
    ["source", { targetParentId: null, sourcePassword: "source-secret" }],
    ["source", { sourcePassword: "source-secret", targetPassword: null }],
    ["source", { targetParentId: "open-target", sourcePassword: "source-secret" }],
    ["plain", { targetParentId: "target", targetPassword: "target-secret" }],
    ["plain", { targetParentId: "open-target" }],
    ["foreign-source", { sourcePassword: "foreign-source-secret" }],
  ] as const) {
    const task = await submitEntryCommand(admin, id, command, input);
    assert.equal(task.created_by_user_id, admin.id);
    assert.equal(task.type, command === "move" ? "FILE_MOVE_ENTRY" : "FILE_COPY_ENTRY");
    const payload = JSON.parse(JSON.stringify(task.payload));
    assert.deepEqual(payload, { entryId: id, targetParentId: "targetParentId" in input ? input.targetParentId : null });
  }
}

const app = express(); app.use(express.json()); app.use("/files", filesRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address(); assert(address && typeof address !== "string");
const port = address.port;
async function request(command: string, input: unknown, actor: AuthUser = admin) {
  const response = await fetch(`http://127.0.0.1:${port}/files/entries/source/${command}`, {
    method: "POST", headers: { authorization: `Bearer ${signUserToken(actor)}`, "content-type": "application/json" }, body: JSON.stringify(input),
  });
  return { status: response.status, body: await response.json() as any };
}
try {
  const beforeReads = countTasks();
  async function read(url: string, body: unknown, actor: AuthUser = admin, method = "POST") {
    const response = await fetch(`http://127.0.0.1:${port}/files${url}`, {
      method, headers: { authorization: `Bearer ${signUserToken(actor)}`, "content-type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() as any };
  }
  for (const actor of [admin, owner]) {
    const details = await read("/entries/target", { password: "target-secret" }, actor);
    assert.equal(details.status, 200); assert.equal(details.body.entry.id, "target");
    const children = await read("/library/1/entries", { parentId: "target", password: "target-secret" }, actor);
    assert.equal(children.status, 200); assert.deepEqual(children.body.items.map((item: any) => item.id), ["nested"]);
    assert.equal((await read("/entries/target?password=target-secret", undefined, actor, "GET")).status, 200);
    assert.equal((await read("/library/1/entries?parentId=target&password=target-secret", undefined, actor, "GET")).status, 200);
  }
  assert.equal((await read("/entries/target", { password: "wrong" })).status, 403);
  assert.equal((await read("/library/1/entries", { parentId: "target", password: "wrong" })).status, 403);
  assert.equal((await read("/entries/target", { password: "target-secret" }, foreign)).status, 404);
  assert.equal((await read("/library/1/entries", { parentId: "target", password: "target-secret" }, foreign)).status, 404);
  assert.equal((await read("/library/1/entries", { parentId: "foreign-target", password: "foreign-secret" })).status, 400);
  assert.equal((await read("/library/3/entries", {})).status, 403);
  for (const body of [[], { password: {} }]) {
    assert.equal((await read("/entries/target", body)).status, 400);
    assert.equal((await read("/library/1/entries", body)).status, 400);
  }
  assert.equal(countTasks(), beforeReads, "credentialed browse aliases must remain read-only");
  for (const command of ["move", "copy"]) {
    const valid = { targetParentId: "target", sourcePassword: "source-secret", targetPassword: "target-secret" };
    assert.equal((await request(command, valid)).status, 201);
    for (const actor of [owner, foreign, demoted]) assert.equal((await request(command, valid, actor)).status, 403);
    const wrongSource = await request(command, { ...valid, sourcePassword: "wrong" });
    assert.equal(wrongSource.status, 403); assert.match(wrongSource.body.message, /^源条目：/);
    const wrongTarget = await request(command, { ...valid, targetPassword: "wrong" });
    assert.equal(wrongTarget.status, 403); assert.match(wrongTarget.body.message, /^目标目录：/);
    assert.equal((await request(command, { ...valid, sourcePassword: {} })).status, 400);
  }
  const saved = JSON.stringify(db.prepare("SELECT payload FROM tasks").all());
  for (const secret of ["source-secret", "target-secret", "foreign-secret", "foreign-source-secret", "obsolete-wrong-secret"]) assert(!saved.includes(secret));
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  db.close();
}
console.log("move/copy credential regressions passed");
