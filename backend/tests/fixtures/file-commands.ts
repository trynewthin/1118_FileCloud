import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
const temp = process.env.FILECLOUD_DATA_DIR;
assert(temp && path.basename(temp).startsWith("filecloud-commands-"));
assert.equal(process.env.FILECLOUD_DB_PATH, path.join(temp, "test.db"));
const { db, initDatabase } = await import("../../src/core/db/index.ts");
const { signUserToken } = await import("../../src/core/auth/jwt.ts");
const { createFolder, submitEntryCommand, submitIndexCommand } = await import("../../src/modules/files/application.ts");
const { filesRouter } = await import("../../src/modules/files/router.ts");
const { setEntryPassword } = await import("../../src/modules/files/security.ts");

initDatabase();
const root = path.join(process.env.FILECLOUD_DATA_DIR!, "allowed/library");
const otherRoot = path.join(process.env.FILECLOUD_DATA_DIR!, "allowed/other");
const outside = path.join(process.env.FILECLOUD_DATA_DIR!, "outside");
for (const directory of [root, otherRoot, outside]) fs.mkdirSync(directory, { recursive: true });
db.exec("INSERT INTO users(id, username, role) VALUES(1,'owner','user'),(2,'admin','admin')");
const admin = { id: 2, username: "admin", role: "admin" as const };
const user = { id: 1, username: "owner", role: "user" as const };
for (const [id, rootPath, enabled] of [[1, root, 1], [2, otherRoot, 1], [3, path.join(root,"disabled"), 0], [4, outside, 1], [5, path.join(root,"missing-root"), 1]] as const) {
  db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name,is_enabled) VALUES(?,1,?,'Library',?)").run(id, rootPath, enabled);
}
function entry(id: string, name: string, directory = 0, library = 1, deleted = 0) {
  db.prepare("INSERT INTO file_entries(id,library_id,is_directory,original_name,is_deleted) VALUES(?,?,?,?,?)").run(id, library, directory, name, deleted);
}
entry("file", "file.txt"); fs.writeFileSync(path.join(root, "file.txt"), "hello");
entry("folder", "folder", 1); fs.mkdirSync(path.join(root, "folder"));
entry("other", "other", 1, 2); fs.mkdirSync(path.join(otherRoot, "other"));
entry("deleted", "deleted.txt", 0, 1, 1);
entry("link", "link", 1); fs.symlinkSync(outside, path.join(root, "link"));
const countTasks = () => (db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as {n:number}).n;
const rejects = (fn: () => Promise<unknown>, status: number) => assert.rejects(fn, (error: any) => error.status === status);
(await rejects(async () => (await createFolder(undefined, 1, {name:"no"})), 401));
(await rejects(async () => (await createFolder(user, 1, {name:"no"})), 403));
(await rejects(async () => (await submitEntryCommand(user, "file", "delete", {})), 403));
(await rejects(async () => (await submitIndexCommand(user, 1, "library", {})), 403));
(await rejects(async () => (await createFolder(admin, 3, {name:"no"})), 403));
(await rejects(async () => (await createFolder(admin, 4, {name:"no"})), 403));
for (const name of ["..", ".", "a/b", " ", "a\\b"]) (await rejects(async () => (await createFolder(admin, 1, {name})), 400));
(await rejects(async () => (await createFolder(admin, 1, {name:"no",parentId:"other"})), 400));
(await rejects(async () => (await createFolder(admin, 1, {name:"no",parentId:"file"})), 400));
(await rejects(async () => (await createFolder(admin, 1, {name:"no",parentId:"link"})), 403));
const bootstrapped = (await createFolder(admin, 5, {name:"first"}));
assert(fs.statSync(path.join(root,"missing-root/first")).isDirectory());
const created = (await createFolder(admin, 1, {name:" nested ",parentId:"folder"}));
assert.equal(created.entry.name, "nested");
assert(fs.statSync(path.join(root,"folder/nested")).isDirectory());
assert.equal((db.prepare("SELECT parent_id FROM file_entries WHERE id=?").get(created.entry.id) as any).parent_id,"folder");
(await rejects(async () => (await createFolder(admin, 1, {name:"nested",parentId:"folder"})), 400));
// Compensate a failed index insert without leaving an orphan folder.
db.exec("CREATE TRIGGER fail_folder BEFORE INSERT ON file_entries WHEN NEW.original_name='db-failure' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
await assert.rejects(async () => (await createFolder(admin,1,{name:"db-failure"})));
assert.equal(fs.existsSync(path.join(root,"db-failure")), false);
db.exec("DROP TRIGGER fail_folder");
assert.equal(countTasks(), 0);
(await rejects(async () => (await submitEntryCommand(admin,"file","move",{targetParentId:"other"})),400));
(await rejects(async () => (await submitEntryCommand(admin,"folder","copy",{})),400));
(await rejects(async () => (await submitEntryCommand(admin,"file","restore",{})),400));
(await rejects(async () => (await submitEntryCommand(admin,"file","destroy",{})),400));
(await rejects(async () => (await submitEntryCommand(admin,"deleted","delete",{})),404));
(await rejects(async () => (await submitEntryCommand(admin,"file","rename",{newName:3})),400));
(await rejects(async () => (await submitIndexCommand(admin,1,"path",{relativePath:"../.."})),403));
setEntryPassword("file","secret");
(await rejects(async () => (await submitEntryCommand(admin,"file","delete",{})),403));
setEntryPassword("folder","secret");
(await rejects(async () => (await submitEntryCommand(admin,"file","move",{targetParentId:"folder",password:"wrong"})),403));
assert.equal(countTasks(),0);

const app = express(); app.use(express.json()); app.use("/files", filesRouter);
const server = app.listen(0,"127.0.0.1");
await new Promise<void>(resolve=>server.once("listening",resolve));
const address=server.address(); assert(address && typeof address!=="string");
const port = address.port;
async function request(url:string,body:unknown,actor=admin) {
  const result=await fetch(`http://127.0.0.1:${port}/files${url}`,{method:"POST",headers:{authorization:`Bearer ${signUserToken(actor)}`,"content-type":"application/json"},body:JSON.stringify(body)});
  return {status:result.status,body:await result.json() as any};
}
try {
  let response=await request("/library/1/mkdir",{name:"http"});
  assert.equal(response.status,201); assert.equal(response.body.message,"文件夹创建成功"); assert.equal(response.body.entry.name,"http");
  assert.equal((await request("/entries/file/rename",{newName:[],password:"secret"})).status,400);
  for(const [command,body,payload,type] of [
    ["rename",{newName:"new.txt",password:"secret"},{entryId:"file",newName:"new.txt"},"FILE_RENAME_ENTRY"],
    ["move",{targetParentId:"folder",password:"secret"},{entryId:"file",targetParentId:"folder"},"FILE_MOVE_ENTRY"],
    ["copy",{password:"secret",newName:"copy.txt"},{entryId:"file",targetParentId:null,newName:"copy.txt"},"FILE_COPY_ENTRY"],
    ["delete",{password:"secret"},{entryId:"file"},"FILE_DELETE_ENTRY"],
  ] as const) {
    response=await request(`/entries/file/${command}`,body);
    assert.equal(response.status,201); assert.equal(response.body.task.type,type); assert.deepEqual(response.body.task.payload,payload); assert.equal(response.body.task.created_by_user_id,2);
  }
  for(const command of ["restore","destroy"]) {
    response=await request(`/entries/deleted/${command}`,{}); assert.equal(response.status,201); assert.deepEqual(response.body.task.payload,{entryId:"deleted"});
  }
  response=await request("/library/1/index",{forceReindex:true}); assert.equal(response.status,201); assert.deepEqual(response.body.task.payload,{libraryId:1,forceReindex:true});
  response=await request("/library/1/index-path",{relativePath:"folder"}); assert.equal(response.status,201); assert.deepEqual(response.body.task.payload,{libraryId:1,relativePath:"folder"});
  assert.equal(fs.readFileSync(path.join(root,"file.txt"),"utf8"),"hello");
  assert.equal(countTasks(),8); // enqueue only; no executor or production database is started
  const form = new FormData();
  form.append("file", new Blob(["uploaded over HTTP"]), "http-upload.txt");
  const uploaded = await fetch(`http://127.0.0.1:${port}/files/library/1/upload`, {
    method: "POST", headers: { authorization: `Bearer ${signUserToken(admin)}` }, body: form,
  });
  assert.equal(uploaded.status, 201);
  const uploadBody = await uploaded.json() as any;
  assert.equal(uploadBody.uploaded, 1);
  assert.equal(uploadBody.task.type, "FILE_INDEX_LIBRARY");
  assert.equal(fs.readFileSync(path.join(root, "http-upload.txt"), "utf8"), "uploaded over HTTP");
  assert.equal(countTasks(), 9);
} finally { server.close(); db.close(); }
console.log("file command regressions passed");
