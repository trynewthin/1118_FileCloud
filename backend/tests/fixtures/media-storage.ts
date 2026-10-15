import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { mock, spyOn } from "bun:test";
import * as childProcess from "node:child_process";
import express from "express";
import { db, initDatabase } from "../../src/core/db/index.ts";
import { signUserToken } from "../../src/core/auth/jwt.ts";

const root = process.env.FILECLOUD_DATA_DIR!;
assert(root.includes("filecloud-media-storage-"));
initDatabase();
db.exec("INSERT INTO users(id,username,role) VALUES(1,'media-owner','user')");
db.exec("INSERT INTO ai_chat_conversations(id,user_id,model_id,title) VALUES(1,1,1,'Media test')");
const libraryRoot = path.join(root, "library");
fs.mkdirSync(libraryRoot);
db.prepare("INSERT INTO file_libraries(id,user_id,root_path,display_name,is_enabled) VALUES(1,1,?,'media',1)").run(libraryRoot);
for (const [id, filename, ext] of [["video", "video.mp4", "mp4"], ["image", "image.jpg", "jpg"]]) {
  db.prepare("INSERT INTO file_entries(id,library_id,is_directory,original_name,extension) VALUES(?,1,0,?,?)").run(id!, filename!, ext!);
  fs.writeFileSync(path.join(libraryRoot, filename!), "source-content");
}

// Delay real temporary-file I/O and fake ffmpeg; never invoke external tools.
const originalFs = { ...fsPromises };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};
type IoOperation = "writeFile" | "readFile" | "readdir" | "unlink" | "rename";
const gates = new Map<IoOperation, { entered: ReturnType<typeof deferred>; released: ReturnType<typeof deferred> }>();
const gateNext = (name: IoOperation) => {
  const gate = { entered: deferred(), released: deferred() };
  gates.set(name, gate);
  return gate;
};
let failNextRename = false;
const delayedFs = { ...fsPromises };
for (const name of ["writeFile", "readFile", "readdir", "unlink", "rename"] as const) {
  (delayedFs as any)[name] = async (...args: any[]) => {
    const gate = gates.get(name);
    if (gate) {
      gates.delete(name);
      gate.entered.resolve();
      await gate.released.promise;
    }
    if (name === "rename" && failNextRename) {
      failNextRename = false;
      throw new Error("mock output rename failure");
    }
    return (originalFs[name] as (...values: any[]) => Promise<any>)(...args);
  };
}
mock.module("node:fs/promises", () => ({ ...delayedFs, default: delayedFs }));
let processMode: "success" | "failure" | "spawn-error" = "success";
let killed = false;
spyOn(childProcess, "spawn").mockImplementation(((_command: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { killed = true; return true; };
    queueMicrotask(async () => {
      try {
        if (processMode === "spawn-error") {
          child.emit("error", new Error("mock spawn failure"));
          child.emit("close", -1);
          return;
        }
        await originalFs.writeFile(args.at(-1)!, Buffer.alloc(2048, 1));
        child.stderr.emit("data", Buffer.from("Duration: 00:00:10.00\n"));
        child.stdout.emit("data", Buffer.from("out_time_ms=5000000\n"));
        child.emit("close", processMode === "failure" || killed ? 1 : 0);
      } catch (error) {
        child.emit("error", error);
        child.emit("close", 1);
      }
    });
    return child;
}) as typeof childProcess.spawn);

const storage = await import("../../src/modules/ai/conversationFiles/storage.ts");
const conversationFiles = await import("../../src/modules/ai/conversationFiles/service.ts");
const { default: conversationFilesRouter } = await import("../../src/modules/ai/conversationFiles/router.ts");
const { buildImageAttachmentsFromUploadIds } = await import("../../src/modules/ai/attachments.ts");
const { deleteAiChatConversation } = await import("../../src/modules/ai/service.ts");
const backgrounds = await import("../../src/modules/backgrounds/service.ts");
const { backgroundsRouter } = await import("../../src/modules/backgrounds/router.ts");
const { fileContentRouter } = await import("../../src/modules/fileContent/router.ts");
const { generateThumbnailForEntry } = await import("../../src/modules/fileContent/thumbnailTasks.ts");
const transcodes = await import("../../src/modules/fileContent/transcodeService.ts");
const token = signUserToken({ id: 1, username: "media-owner", role: "user" });
const app = express();
app.use("/ai/files", conversationFilesRouter);
app.use("/backgrounds", backgroundsRouter);
app.use("/media", fileContentRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
const headers = { authorization: `Bearer ${token}` };
const waitForGate = async <T>(operation: Promise<T>, gate: ReturnType<typeof gateNext>): Promise<T> => {
  let settled = false;
  void operation.then(() => { settled = true; }, () => { settled = true; });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      gate.entered.promise,
      operation.then(() => { throw new Error("Operation completed before reaching delayed I/O"); }),
      new Promise<void>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("I/O gate was not reached")), 2000); }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(settled, false, "result must remain pending until I/O finishes");
  } finally {
    clearTimeout(timeout);
    gate.released.resolve();
  }
  return operation;
};

const syncMethods = ["existsSync", "statSync", "lstatSync", "realpathSync", "readFileSync", "writeFileSync", "mkdirSync", "readdirSync", "unlinkSync", "rmSync", "renameSync"] as const;
const savedSync = new Map(syncMethods.map((name) => [name, fs[name]]));
for (const name of syncMethods) {
  (fs as any)[name] = () => { throw new Error(`Blocking filesystem operation in request/task: ${name}`); };
}
try {
  await assert.rejects(originalFs.stat(storage.getConversationFilesRoot()), { code: "ENOENT" });
  assert.throws(() => storage.getAbsolutePath("../ai_conversation_files-other/escape.txt"), /文件路径不合法/);
  const uploadGate = gateNext("writeFile");
  const form = new FormData();
  form.append("conversationId", "1");
  form.append("file", new File(["image-data"], "sample.png", { type: "image/png" }));
  const uploadedResponse = await waitForGate(fetch(`${base}/ai/files`, { method: "POST", headers, body: form }), uploadGate);
  assert.equal(uploadedResponse.status, 200);
  const uploaded = (await uploadedResponse.json() as any).uploads;
  assert.equal(uploaded.length, 1);
  assert.equal(uploaded[0].sizeBytes, 10);
  const uploadedFile = conversationFiles.getFileById(uploaded[0].id)!;
  assert.equal(await storage.readFileAsString(uploadedFile.relative_path), "image-data");
  assert.equal(await storage.getFileSize(uploadedFile.relative_path), 10);
  const attachmentGate = gateNext("readFile");
  const attachments = await waitForGate(buildImageAttachmentsFromUploadIds([uploadedFile.id]), attachmentGate);
  assert.equal(attachments[0]?.dataBase64, Buffer.from("image-data").toString("base64"));
  const fileResponse = await fetch(`${base}/ai/files/${uploadedFile.id}/content`, { headers });
  assert.equal(fileResponse.status, 200);
  assert.equal(await fileResponse.text(), "image-data");
  const generatedGate = gateNext("writeFile");
  const generated = await waitForGate(conversationFiles.createGeneratedFile({ userId: 1, conversationId: 1, originalName: "report.md", content: "# Report" }), generatedGate);
  assert.equal(generated.file.size_bytes, 8);
  assert.equal(await storage.readFileAsString(generated.file.relative_path), "# Report");

  const background = await backgrounds.saveBackgroundImage({ originalname: "wallpaper.png", buffer: Buffer.from("background-data"), size: 15 });
  const listGate = gateNext("readdir");
  const listResponse = await waitForGate(fetch(`${base}/backgrounds`, { headers }), listGate);
  assert.equal(listResponse.status, 200);
  assert.deepEqual((await listResponse.json() as any).images.map((item: any) => item.id), [background.id]);
  assert.equal(await (await fetch(`${base}/backgrounds/${background.id}`)).text(), "background-data");
  const deleteBackgroundGate = gateNext("unlink");
  assert.equal((await waitForGate(fetch(`${base}/backgrounds/${background.id}`, { method: "DELETE", headers }), deleteBackgroundGate)).status, 200);
  assert.equal(await backgrounds.getBackgroundImagePath(background.id), null);

  const streamResponse = await fetch(`${base}/media/video/stream`, { headers });
  assert.equal(streamResponse.status, 200);
  assert.equal(await streamResponse.text(), "source-content");
  const thumbnailGate = gateNext("rename");
  await waitForGate(generateThumbnailForEntry("image"), thumbnailGate);
  const thumbResponse = await fetch(`${base}/media/image/thumbnail`, { headers });
  assert.equal(thumbResponse.status, 200);
  assert.equal((await thumbResponse.arrayBuffer()).byteLength, 2048);
  assert.equal((await fetch(`${base}/media/image/thumbnail`, { headers: { ...headers, "if-none-match": thumbResponse.headers.get("etag")! } })).status, 304);
  const transcodeGate = gateNext("rename");
  const transcoded = await waitForGate(transcodes.executeTranscode("video"), transcodeGate);
  assert.equal(transcoded.success, true);
  assert.equal(transcoded.outputSize, 2048);
  transcodes.createOrResetTranscode("video", 1, 1);
  transcodes.markTranscodeCompleted("video", transcoded.outputPath!, transcoded.outputSize!);
  const transcodedResponse = await fetch(`${base}/media/video/stream/transcoded`, { headers });
  assert.equal(transcodedResponse.status, 200);
  assert.equal((await transcodedResponse.arrayBuffer()).byteLength, 2048);
  const transcodeDeleteGate = gateNext("unlink");
  await waitForGate(transcodes.deleteTranscodeForEntry("video"), transcodeDeleteGate);
  assert.equal(transcodes.getTranscodeForEntry("video"), null);
  failNextRename = true;
  assert.match((await transcodes.executeTranscode("video")).error!, /mock output rename failure/);
  await assert.rejects(originalFs.stat(path.join(libraryRoot, ".filecloud_meta/transcoded/video.mp4")), { code: "ENOENT" });
  processMode = "failure";
  assert.equal((await transcodes.executeTranscode("video")).success, false);
  await assert.rejects(originalFs.stat(path.join(libraryRoot, ".filecloud_meta/transcoded/video.mp4")), { code: "ENOENT" });
  processMode = "spawn-error";
  assert.match((await transcodes.executeTranscode("video")).error!, /mock spawn failure/);
  processMode = "success";
  assert.match((await transcodes.executeTranscode("video", () => { throw new Error("cancelled by test"); })).error!, /cancelled by test/);
  assert.equal(killed, true);
  await assert.rejects(originalFs.stat(path.join(libraryRoot, ".filecloud_meta/transcoded/video.mp4")), { code: "ENOENT" });

  const deleteConversationGate = gateNext("unlink");
  assert.equal(await waitForGate(deleteAiChatConversation(1), deleteConversationGate), true);
  assert.equal(conversationFiles.getFileById(uploadedFile.id), null);
  assert.equal(await storage.fileExists(uploadedFile.relative_path), false);
  assert.equal(await storage.fileExists(generated.file.relative_path), false);
  console.log("Async media storage regression checks passed");
} finally {
  for (const [name, implementation] of savedSync) (fs as any)[name] = implementation;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  db.close();
}
