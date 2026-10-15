import fs from "node:fs";
import { pathExists } from "../fs.ts";
import path from "node:path";
import { getFsAllowedPaths } from "./paths.ts";

export class PathAccessError extends Error {
  readonly status = 403;

  constructor(message = "无权访问此路径") {
    super(message);
    this.name = "PathAccessError";
  }
}

// path.relative respects platform case semantics and does not confuse sibling
// prefixes (e.g. /data and /database). Never lowercase Linux paths.
export const isPathWithin = (root: string, target: string): boolean => {
  const relative = path.relative(root, target);
  return relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};

/** Resolve existing ancestors, including symlinks, before appending a missing tail.
 * lstat deliberately rejects dangling symlinks rather than treating them as an
 * absent file; otherwise a later write could follow their out-of-root target.
 */
export const canonicalizeFilesystemPath = async (targetPath: string): Promise<string> => {
  if (typeof targetPath !== "string" || !targetPath.trim() || targetPath.includes("\0")) {
    throw new PathAccessError("路径不合法");
  }

  let ancestor = path.resolve(targetPath);
  const missing: string[] = [];
  while (true) {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.lstat(ancestor);
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw new PathAccessError("无法安全访问此路径");
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new PathAccessError("路径不存在");
      missing.unshift(path.basename(ancestor));
      ancestor = parent;
      continue;
    }

    try {
      const canonical = await fs.promises.realpath(ancestor);
      if (missing.length > 0 && !(stat.isDirectory() || (stat.isSymbolicLink() && (await fs.promises.stat(canonical)).isDirectory()))) {
        throw new PathAccessError("父路径不是文件夹");
      }
      return path.join(canonical, ...missing);
    } catch (error) {
      if (error instanceof PathAccessError) throw error;
      throw new PathAccessError("无法安全访问此路径");
    }
  }
};

/** FS_ALLOWED_PATHS retains its existing empty = unrestricted policy. */
export const assertAllowedFilesystemPath = async (targetPath: string): Promise<string> => {
  const canonical = await canonicalizeFilesystemPath(targetPath);
  const allowed = getFsAllowedPaths();
  if (allowed.length === 0) return canonical;
  let permitted = false;
  for (const root of allowed) {
    try {
      if (isPathWithin(await canonicalizeFilesystemPath(root), canonical)) { permitted = true; break; }
    } catch {
      // An inaccessible/malformed configured root never grants access.
    }
  }
  if (!permitted) throw new PathAccessError();
  return canonical;
};

export const assertLibraryRootPath = async (rootPath: string): Promise<string> => {
  const canonical = await assertAllowedFilesystemPath(rootPath);
  if (await pathExists(canonical) && !(await fs.promises.stat(canonical)).isDirectory()) {
    throw new PathAccessError("文件库根路径必须是文件夹");
  }
  return canonical;
};

/** A file name is exactly one portable path component, never a supplied path. */
export const assertValidPathSegment = (name: string): string => {
  if (typeof name !== "string" || !name.trim() || name === "." || name === ".." ||
      /[\\/\0]/.test(name) || path.win32.isAbsolute(name) ||
      (process.platform === "win32" && /[:<>"|?*]|[. ]$/.test(name))) {
    throw new PathAccessError("文件名不合法");
  }
  return name;
};

/** Use the returned path for I/O, not the original joined path. */
export const resolvePathWithinLibrary = async (rootPath: string, relativePath: string): Promise<string> => {
  const root = await assertLibraryRootPath(rootPath);
  if (typeof relativePath !== "string" || relativePath.includes("\0") ||
      path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new PathAccessError("文件路径不合法");
  }
  const candidate = path.resolve(root, relativePath);
  if (!isPathWithin(root, candidate)) throw new PathAccessError();
  const canonical = await assertAllowedFilesystemPath(candidate);
  if (!isPathWithin(root, canonical)) throw new PathAccessError();
  return canonical;
};

/** Mutating a canonicalized symlink target would rename/delete the target rather
 * than the user's selected link. Reject links below the root for all writes.
 */
export const resolveMutationPathWithinLibrary = async (rootPath: string, relativePath: string): Promise<string> => {
  const root = await assertLibraryRootPath(rootPath);
  const canonical = await resolvePathWithinLibrary(root, relativePath);
  const relative = path.relative(root, path.resolve(root, relativePath));
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if ((await fs.promises.lstat(current)).isSymbolicLink()) {
        throw new PathAccessError("不允许修改符号链接路径");
      }
    } catch (error: any) {
      if (error?.code === "ENOENT") break;
      if (error instanceof PathAccessError) throw error;
      throw new PathAccessError("无法安全访问此路径");
    }
  }
  return canonical;
};

/** Preflight directory copies: do not let a nested link export outside data. */
export const assertSafeDirectoryTree = async (
  rootPath: string,
  targetPath: string,
  options: { rejectSymlinks?: boolean } = {},
): Promise<void> => {
  const root = await assertLibraryRootPath(rootPath);
  const visit = async (candidate: string): Promise<void> => {
    await resolvePathWithinLibrary(root, path.relative(root, candidate));
    const stat = await fs.promises.lstat(candidate);
    if (options.rejectSymlinks && stat.isSymbolicLink()) {
      throw new PathAccessError("不允许移动包含符号链接的目录");
    }
    // Validate link destinations but do not follow links recursively (cycles).
    if (stat.isDirectory()) {
      for (const child of await fs.promises.readdir(candidate)) await visit(path.join(candidate, child));
    }
  };
  await visit(targetPath);
};

/** Existing-root variant for background probes: no synchronous filesystem I/O.
 * Unlike the mutation policy, missing paths cannot count as online. */
export const assertExistingLibraryRootPathAsync = async (rootPath: string): Promise<string> => {
  if (typeof rootPath !== "string" || !rootPath.trim() || rootPath.includes("\0")) throw new PathAccessError("路径不合法");
  const canonical = await fs.promises.realpath(rootPath);
  const allowed = getFsAllowedPaths();
  let permitted = allowed.length === 0;
  for (const root of allowed) {
    try {
      if (isPathWithin(await fs.promises.realpath(root), canonical)) { permitted = true; break; }
    } catch { /* Inaccessible allowlist roots cannot grant access. */ }
  }
  if (!permitted) throw new PathAccessError();
  if (!(await fs.promises.stat(canonical)).isDirectory()) throw new PathAccessError("文件库根路径必须是文件夹");
  return canonical;
};
