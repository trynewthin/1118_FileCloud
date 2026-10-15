import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { db, initDatabase } from "../../src/core/db/index.ts";
import { createFileLibrary, refreshFileLibraryStatus, getFileLibraryStats } from "../../src/modules/fileLibraries/service.ts";
import { buildRelativePathForEntry, getEntryAncestors, getEntryById, resolveRealPathForEntry } from "../../src/modules/files/service.ts";
import { assertLibraryRootOwnership } from "../../src/modules/files/security.ts";
import { resolveFileForStreaming } from "../../src/modules/fileContent/service.ts";
import { getThumbnailPathForEntry } from "../../src/modules/fileContent/thumbnails.ts";
import { createOrResetTranscode, markTranscodeCompleted, getTranscodedFilePath } from "../../src/modules/fileContent/transcodeService.ts";
import { generateThumbnailForEntry } from "../../src/modules/fileContent/thumbnailTasks.ts";
import { PathAccessError } from "../../src/core/config/pathSecurity.ts";

const fixture = process.env.FILECLOUD_PATH_TEST_ROOT!;
assert.ok(fixture.includes("filecloud-path-services-"));
const allowed = path.join(fixture, "libraries");
const outside = path.join(fixture, "outside");
const first = path.join(allowed, "first");
const second = path.join(allowed, "second");
fs.mkdirSync(first, { recursive: true });
fs.mkdirSync(second, { recursive: true });
fs.mkdirSync(outside);
fs.writeFileSync(path.join(outside, "private.txt"), "private outside data");
initDatabase();
db.prepare("INSERT INTO users(id, username, role) VALUES (1, 'one', 'user'), (2, 'two', 'user')").run();
const lib = (await createFileLibrary({ userId: 1, rootPath: first }));
assert.equal(lib.root_path, fs.realpathSync(first));
await assert.rejects(async () => (await createFileLibrary({ userId: 1, rootPath: outside })), PathAccessError);
await assert.rejects(async () => (await createFileLibrary({ userId: 2, rootPath: first })), PathAccessError);
await assert.rejects(async () => (await createFileLibrary({ userId: 2, rootPath: path.join(first, "child") })), PathAccessError);
await assert.rejects(async () => (await createFileLibrary({ userId: 2, rootPath: allowed })), PathAccessError);
const alias = path.join(allowed, "alias");
fs.symlinkSync(first, alias, "dir");
await assert.rejects(async () => (await createFileLibrary({ userId: 2, rootPath: alias })), PathAccessError);
fs.symlinkSync(outside, path.join(allowed, "escape-root"), "dir");
await assert.rejects(async () => (await createFileLibrary({ userId: 1, rootPath: path.join(allowed, "escape-root") })), PathAccessError);
const lib2 = (await createFileLibrary({ userId: 2, rootPath: second }));
assert.equal(Number((db.prepare("SELECT COUNT(*) AS n FROM file_libraries").get() as any).n), 2);
assert.equal(Number((db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as any).n), 2);
await assert.rejects(async () => (await assertLibraryRootOwnership(first, 2)), PathAccessError);

const insert = (id: string, name: string, parent: string | null = null, directory = false, library = lib.id, ext = "txt") => {
  db.prepare("INSERT INTO file_entries(id, library_id, parent_id, original_name, is_directory, extension) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, library, parent, name, directory ? 1 : 0, ext);
};
insert("safe", "safe.txt");
fs.writeFileSync(path.join(first, "safe.txt"), "safe content");
assert.equal((await resolveFileForStreaming("safe")).realPath, path.join(first, "safe.txt"));
assert.equal((await resolveFileForStreaming("safe")).size, 12);
insert("escape", "escape.txt");
fs.symlinkSync(path.join(outside, "private.txt"), path.join(first, "escape.txt"));
await assert.rejects(async () => (await resolveFileForStreaming("escape")), PathAccessError);
insert("dangling", "dangling.txt");
fs.symlinkSync(path.join(outside, "future.txt"), path.join(first, "dangling.txt"));
await assert.rejects(async () => (await resolveRealPathForEntry(getEntryById("dangling")!, first)), PathAccessError);
insert("traversal", "../outside");
assert.throws(() => buildRelativePathForEntry(getEntryById("traversal")!), PathAccessError);
insert("orphan", "child.txt", "missing");
assert.throws(() => buildRelativePathForEntry(getEntryById("orphan")!), PathAccessError);
insert("cycle1", "one", "cycle2", true);
insert("cycle2", "two", "cycle1", true);
assert.throws(() => buildRelativePathForEntry(getEntryById("cycle1")!), PathAccessError);
assert.throws(() => getEntryAncestors(getEntryById("cycle1")!), PathAccessError);
insert("foreign-parent", "foreign", null, true, lib2.id);
insert("foreign-child", "child", "foreign-parent");
assert.throws(() => buildRelativePathForEntry(getEntryById("foreign-child")!), PathAccessError);
assert.throws(() => getEntryAncestors(getEntryById("foreign-child")!), PathAccessError);
insert("file-parent-child", "child", "safe");
assert.throws(() => buildRelativePathForEntry(getEntryById("file-parent-child")!), PathAccessError);

// Metadata reads and generated output must obey the same boundary as originals.
insert("image", "image.jpg", null, false, lib.id, "jpg");
fs.writeFileSync(path.join(first, "image.jpg"), "placeholder image");
fs.mkdirSync(path.join(first, ".filecloud_meta"));
fs.symlinkSync(outside, path.join(first, ".filecloud_meta/thumbnails"), "dir");
await assert.rejects(async () => (await getThumbnailPathForEntry("image")), PathAccessError);
await assert.rejects(generateThumbnailForEntry("image"), PathAccessError);
fs.symlinkSync(outside, path.join(first, ".filecloud_meta/transcoded"), "dir");
createOrResetTranscode("safe", lib.id, 1);
markTranscodeCompleted("safe", "private.txt", 20);
await assert.rejects(async () => (await getTranscodedFilePath("safe")), PathAccessError);

// Read-only capacity scans ignore links rather than stat-ing outside content.
assert.equal((await refreshFileLibraryStatus(lib.id))?.current_size_bytes, 29);
assert.equal((await getFileLibraryStats(lib.id))?.diskSizeBytes, 29);
assert.equal(fs.readFileSync(path.join(outside, "private.txt"), "utf8"), "private outside data");
// Awaiting canonical paths must not let concurrent owners register one root.
const raceRoot = path.join(allowed, "registration-race");
fs.mkdirSync(raceRoot);
const registrations = await Promise.allSettled([
  createFileLibrary({ userId: 1, rootPath: raceRoot }),
  createFileLibrary({ userId: 2, rootPath: raceRoot }),
]);
assert.equal(registrations.filter(result => result.status === "fulfilled").length, 1);
assert.equal(registrations.filter(result => result.status === "rejected").length, 1);
assert.equal((db.prepare("SELECT COUNT(*) AS n FROM file_libraries WHERE root_path=?").get(raceRoot) as any).n, 1);
db.close();
console.log("Path service regression checks passed");
