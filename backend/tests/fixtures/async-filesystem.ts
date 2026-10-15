import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

const temp = process.env.FILECLOUD_DATA_DIR!;
assert(path.basename(temp).startsWith("filecloud-async-fs-"));
assert.equal(process.env.FILECLOUD_DB_PATH, path.join(temp, "test.db"));
const { db, initDatabase } = await import("../../src/core/db/index.ts");
const { assertLibraryRootPath } = await import("../../src/core/config/pathSecurity.ts");
const { createFileLibrary, refreshFileLibraryStatus, getFileLibraryStats } = await import("../../src/modules/fileLibraries/service.ts");
const { createFolder } = await import("../../src/modules/files/application.ts");
const { receiveUpload } = await import("../../src/modules/files/uploadService.ts");
const { handleIndexSingleTask } = await import("../../src/modules/files/indexTasks.ts");
const { copyEntry, moveEntry, renameEntry, moveEntryToTrash, restoreEntryFromTrash, permanentlyDeleteEntry } = await import("../../src/modules/files/fileOps.ts");
const { listDeletedEntriesByLibrary } = await import("../../src/modules/files/service.ts");
const { isLibraryOnline, refreshLibraryStatus, stopLibraryWatcher } = await import("../../src/modules/coreServices/libraryWatcher.ts");
const { listAccessibleLibraries, assertEntryAccess } = await import("../../src/core/auth/libraryAccess.ts");
const { listSystemDirectories } = await import("../../src/modules/system/service.ts");
initDatabase();
db.exec("INSERT INTO users(id,username,role) VALUES(1,'admin','admin'),(2,'owner','user')");
const root = path.join(temp, "library");
fs.mkdirSync(root);
const admin = { id: 1, username: "admin", role: "admin" as const };
const owner = { id: 2, username: "owner", role: "user" as const };
const originals = new Map<string, unknown>();
for (const name of ["accessSync", "existsSync", "mkdirSync", "rmdirSync", "readdirSync", "statSync", "lstatSync", "realpathSync", "openSync", "closeSync", "writeFileSync", "readFileSync", "renameSync", "copyFileSync", "cpSync", "rmSync", "unlinkSync", "opendirSync"]) {
  originals.set(name, (fs as any)[name]);
  (fs as any)[name] = () => { throw new Error(`Blocking filesystem call: ${name}`); };
}
try {
  assert.equal(await assertLibraryRootPath(root), root);
  const library = await createFileLibrary({ userId: 2, rootPath: root });
  assert.equal((await listAccessibleLibraries(owner)).length, 1);
  const folder = await createFolder(admin, library.id, { name: "folder" });
  const boundary = "async-test-boundary";
  await receiveUpload(admin, library.id, null, { "content-type": `multipart/form-data; boundary=${boundary}` }, Readable.from([
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="file.txt"\r\nContent-Type: text/plain\r\n\r\ncontents\r\n--${boundary}--\r\n`,
  ]));
  await handleIndexSingleTask({ task: { payload: { libraryId: library.id, relativePath: "file.txt" } }, updateProgress() {}, log: { info() {} } } as any);
  const original = db.prepare("SELECT id FROM file_entries WHERE original_name='file.txt'").get() as { id: string };
  await assertEntryAccess(owner, original.id);
  // An independent writer can reserve a destination after rename/move preflight.
  // Exclusive transfer must preserve both the uploaded target and source data.
  const originalLink = fs.promises.link;
  try {
    for (const kind of ["rename", "move"] as const) {
      const targetName = kind === "rename" ? "race.txt" : "file.txt";
      const targetPath = path.join(root, kind === "rename" ? "" : "folder", targetName);
      let raced = false;
      fs.promises.link = async (source, destination) => {
        if (String(destination) === targetPath && !raced) {
          raced = true;
          await fs.promises.writeFile(targetPath, "competing-upload", { flag: "wx" });
        }
        return originalLink(source, destination);
      };
      await assert.rejects(kind === "rename" ? renameEntry(original.id, targetName) : moveEntry(original.id, folder.entry.id), (error: any) => error.code === "EEXIST");
      assert.equal(raced, true);
      assert.equal(await fs.promises.readFile(targetPath, "utf8"), "competing-upload");
      assert.equal(await fs.promises.readFile(path.join(root, "file.txt"), "utf8"), "contents");
      assert.deepEqual(db.prepare("SELECT parent_id, original_name FROM file_entries WHERE id=?").get(original.id), { parent_id: null, original_name: "file.txt" });
    }
  } finally { fs.promises.link = originalLink; }
  const copy = await copyEntry(original.id, null, "copy.txt");
  await moveEntry(copy, folder.entry.id);
  // Filesystems without hard links use an exclusive copy fallback.
  const savedLink = fs.promises.link;
  fs.promises.link = async () => { throw Object.assign(new Error("cross-device fixture"), { code: "EXDEV" }); };
  try { await renameEntry(copy, "fallback.txt"); }
  finally { fs.promises.link = savedLink; }
  assert.equal(await fs.promises.readFile(path.join(root, "folder/fallback.txt"), "utf8"), "contents");
  // If source removal fails, no DB commit happens and source bytes survive.
  const savedRemove = fs.promises.rm;
  fs.promises.rm = async (target, options) => {
    if (String(target) === path.join(root, "folder/fallback.txt")) throw Object.assign(new Error("remove denied"), { code: "EACCES" });
    return savedRemove(target, options);
  };
  try { await assert.rejects(renameEntry(copy, "stalled.txt"), /remove denied/); }
  finally { fs.promises.rm = savedRemove; }
  assert.equal(await fs.promises.readFile(path.join(root, "folder/fallback.txt"), "utf8"), "contents");
  assert.equal((db.prepare("SELECT original_name FROM file_entries WHERE id=?").get(copy) as any).original_name, "fallback.txt");
  await fs.promises.rm(path.join(root, "folder/stalled.txt"));
  await renameEntry(copy, "renamed.txt");
  await moveEntryToTrash(copy);
  assert.equal((await listDeletedEntriesByLibrary(library.id)).length, 1);
  await restoreEntryFromTrash(copy);
  await moveEntryToTrash(copy);
  await permanentlyDeleteEntry(copy);
  assert.equal((await listDeletedEntriesByLibrary(library.id)).length, 0);
  assert((await refreshFileLibraryStatus(library.id))!.current_size_bytes > 0);
  assert((await getFileLibraryStats(library.id))!.diskSizeBytes > 0);
  assert.equal(await isLibraryOnline(library.id), true);
  assert.equal(await refreshLibraryStatus(library.id), true);
  assert((await listSystemDirectories(root)).some(entry => entry.name === "folder"));
  await stopLibraryWatcher();
} finally {
  for (const [name, original] of originals) (fs as any)[name] = original;
  db.close();
}
console.log("async filesystem regressions passed");
