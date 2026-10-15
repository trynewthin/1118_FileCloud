import { db } from "../db/index.ts";
import {
  assertLibraryRootPath,
  canonicalizeFilesystemPath,
  isPathWithin,
  PathAccessError,
} from "../config/pathSecurity.ts";

// Creating or accessing an overlapping library must not turn its owner's grant
// into access to another user's subtree (or expose a foreign ancestor's data).
export const assertLibraryRootOwnership = async (rootPath: string, ownerId: number): Promise<void> => {
  const root = (await assertLibraryRootPath(rootPath));
  const foreign = db.prepare("SELECT root_path FROM file_libraries WHERE user_id != ?")
    .all(ownerId) as { root_path: string }[];
  for (const library of foreign) {
    let other: string;
    try {
      other = (await canonicalizeFilesystemPath(library.root_path));
    } catch {
      // Invalid legacy roots cannot be accessed by the path policy either.
      continue;
    }
    if (isPathWithin(root, other) || isPathWithin(other, root)) {
      throw new PathAccessError("文件库路径与其他用户的文件库重叠");
    }
  }
};

