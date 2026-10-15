import { access } from "node:fs/promises";
import type { PathLike } from "node:fs";

/** Existence probe without blocking the event loop or hiding access/I/O errors. */
export const pathExists = async (target: PathLike): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch (error: any) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
};
