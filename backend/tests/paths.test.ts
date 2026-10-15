import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertAllowedFilesystemPath,
  assertLibraryRootPath,
  assertSafeDirectoryTree,
  assertValidPathSegment,
  PathAccessError,
  resolvePathWithinLibrary,
  resolveMutationPathWithinLibrary,
} from "../src/core/config/pathSecurity.ts";
import { getFsAllowedPaths } from "../src/core/config/paths.ts";
import { listSystemDirectories } from "../src/modules/system/service.ts";

let fixture: string;
let root: string;
let outside: string;
let originalAllowed: string | undefined;
beforeEach(() => {
  originalAllowed = process.env.FS_ALLOWED_PATHS;
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "filecloud-paths-"));
  root = path.join(fixture, "allowed");
  outside = path.join(fixture, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "private.txt"), "private");
  process.env.FS_ALLOWED_PATHS = root;
});
afterEach(() => {
  if (originalAllowed === undefined) delete process.env.FS_ALLOWED_PATHS;
  else process.env.FS_ALLOWED_PATHS = originalAllowed;
  fs.rmSync(fixture, { recursive: true, force: true });
});

describe("canonical filesystem policy", () => {
  test("allows configured root, normal children, and missing tails", async () => {
    fs.mkdirSync(path.join(root, "nested"));
    expect(await assertLibraryRootPath(root)).toBe(fs.realpathSync(root));
    expect(await resolvePathWithinLibrary(root, "nested/new/deep.txt")).toBe(path.join(root, "nested/new/deep.txt"));
    expect(await assertLibraryRootPath(path.join(root, "new-library"))).toBe(path.join(root, "new-library"));
  });

  test("denies outside roots and sibling-prefix paths", async () => {
    await expect(assertLibraryRootPath(outside)).rejects.toThrow(PathAccessError);
    await expect(assertLibraryRootPath(`${root}-sibling`)).rejects.toThrow(PathAccessError);
    await expect(resolvePathWithinLibrary(root, "../outside/private.txt")).rejects.toThrow(PathAccessError);
    await expect(resolvePathWithinLibrary(root, outside)).rejects.toThrow(PathAccessError);
  });

  test("symlink escapes are denied for existing and missing targets", async () => {
    fs.symlinkSync(outside, path.join(root, "escape"), "dir");
    await expect(assertLibraryRootPath(path.join(root, "escape"))).rejects.toThrow(PathAccessError);
    await expect(resolvePathWithinLibrary(root, "escape/private.txt")).rejects.toThrow(PathAccessError);
    await expect(resolvePathWithinLibrary(root, "escape/new/created.txt")).rejects.toThrow(PathAccessError);
    await expect(listSystemDirectories(path.join(root, "escape"))).rejects.toThrow(PathAccessError);
  });

  test("a dangling symlink cannot disguise a missing leaf", async () => {
    fs.symlinkSync(path.join(outside, "not-yet-created"), path.join(root, "dangling"));
    await expect(resolvePathWithinLibrary(root, "dangling")).rejects.toThrow(PathAccessError);
    await expect(resolvePathWithinLibrary(root, "dangling/child")).rejects.toThrow(PathAccessError);
  });

  test("internal symlinks resolve to their canonical permitted target", async () => {
    fs.mkdirSync(path.join(root, "nested"));
    fs.symlinkSync(path.join(root, "nested"), path.join(root, "alias"), "dir");
    expect(await resolvePathWithinLibrary(root, "alias/new.txt")).toBe(path.join(root, "nested/new.txt"));
  });

  test("mutation paths reject even in-library links without touching targets", async () => {
    const target = path.join(root, "target.txt");
    fs.writeFileSync(target, "keep");
    fs.symlinkSync(target, path.join(root, "alias.txt"));
    await expect(resolveMutationPathWithinLibrary(root, "alias.txt")).rejects.toThrow(PathAccessError);
    fs.mkdirSync(path.join(root, "nested"));
    fs.symlinkSync(path.join(root, "nested"), path.join(root, "alias-dir"), "dir");
    await expect(resolveMutationPathWithinLibrary(root, "alias-dir/new.txt")).rejects.toThrow(PathAccessError);
    expect(await resolveMutationPathWithinLibrary(root, "new/deep/file.txt")).toBe(path.join(root, "new/deep/file.txt"));
    expect(fs.readFileSync(target, "utf8")).toBe("keep");
  });

  test("configured symlink roots remain usable", async () => {
    const alias = path.join(fixture, "configured-root");
    fs.symlinkSync(root, alias, "dir");
    process.env.FS_ALLOWED_PATHS = alias;
    expect(await assertLibraryRootPath(alias)).toBe(root);
    expect(await resolvePathWithinLibrary(alias, "new.txt")).toBe(path.join(root, "new.txt"));
  });

  test("case-sensitive roots are not widened on Linux", async () => {
    if (process.platform !== "linux") return;
    const upper = path.join(fixture, "ALLOWED");
    fs.mkdirSync(upper);
    await expect(assertLibraryRootPath(upper)).rejects.toThrow(PathAccessError);
  });

  test("global unrestricted policy still enforces each library boundary", async () => {
    delete process.env.FS_ALLOWED_PATHS;
    expect(await assertLibraryRootPath(outside)).toBe(outside);
    fs.symlinkSync(outside, path.join(root, "escape"), "dir");
    await expect(resolvePathWithinLibrary(root, "escape/private.txt")).rejects.toThrow(PathAccessError);
  });

  test("empty comma segments never implicitly authorize the working directory", async () => {
    process.env.FS_ALLOWED_PATHS = `,${root}, ,`;
    expect(getFsAllowedPaths()).toEqual([root]);
    await expect(assertAllowedFilesystemPath(process.cwd())).rejects.toThrow(PathAccessError);
  });

  test("recursive copy preflight rejects nested escaping links", async () => {
    const tree = path.join(root, "tree");
    fs.mkdirSync(tree);
    fs.writeFileSync(path.join(tree, "file.txt"), "safe");
    await expect(assertSafeDirectoryTree(root, tree)).resolves.toBeUndefined();
    fs.symlinkSync(outside, path.join(tree, "escape"), "dir");
    await expect(assertSafeDirectoryTree(root, tree)).rejects.toThrow(PathAccessError);
  });

  test("directory mutation preflight rejects internal links too", async () => {
    const tree = path.join(root, "tree");
    fs.mkdirSync(tree);
    fs.writeFileSync(path.join(root, "target.txt"), "keep");
    fs.symlinkSync(path.join(root, "target.txt"), path.join(tree, "internal-link"));
    await expect(assertSafeDirectoryTree(root, tree)).resolves.toBeUndefined();
    await expect(assertSafeDirectoryTree(root, tree, { rejectSymlinks: true })).rejects.toThrow(PathAccessError);
  });

  test("invalid file names cannot carry paths", async () => {
    for (const name of ["", " ", ".", "..", "../private", "dir/file", "dir\\file", "a\0b", "C:\\private"]) {
      expect(() => assertValidPathSegment(name)).toThrow(PathAccessError);
    }
    expect(assertValidPathSegment("正常文件.txt")).toBe("正常文件.txt");
  });

  test("library roots must be directories", async () => {
    const file = path.join(root, "file.txt");
    fs.writeFileSync(file, "data");
    await expect(assertLibraryRootPath(file)).rejects.toThrow(PathAccessError);
    await expect(resolvePathWithinLibrary(root, "file.txt/child")).rejects.toThrow(PathAccessError);
  });
});
