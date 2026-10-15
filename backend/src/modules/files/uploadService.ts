import fs from "node:fs";
import { withLibraryMutation } from "./mutationLock.ts";
import path from "node:path";
import type { IncomingHttpHeaders } from "node:http";
import type { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import type { AuthUser } from "../../core/auth/roles.ts";
import { AccessError, assertEntryAccess, assertFileMutationAccess, assertLibraryAccess } from "../../core/auth/libraryAccess.ts";
import { assertLibraryRootPath, resolveMutationPathWithinLibrary } from "../../core/config/pathSecurity.ts";
import { TaskTypes, type TaskRecord } from "../../core/tasks/types.ts";
import { createTask } from "../tasks/index.ts";
import { buildRelativePathForEntry, getEntryById } from "./service.ts";

/** Receive a multipart upload without relying on an HTTP route's authorization. */
export const receiveUpload = async (
  user: AuthUser | undefined,
  libraryId: number,
  parentId: unknown,
  headers: IncomingHttpHeaders,
  input: Readable,
): Promise<{ uploaded: number; task: TaskRecord }> => {
  // Install guards before asynchronous authorization/path checks: a client may
  // disconnect while those checks are pending, before the parser is attached.
  let earlyFailure = false;
  const onEarlyFailure = () => { earlyFailure = true; };
  const onEarlyClose = () => { if (!input.readableEnded) earlyFailure = true; };
  input.on("error", onEarlyFailure);
  input.on("aborted", onEarlyFailure);
  input.on("close", onEarlyClose);
  try {
    return await withLibraryMutation(libraryId, execute);
  } finally {
    input.off("error", onEarlyFailure);
    input.off("aborted", onEarlyFailure);
    input.off("close", onEarlyClose);
  }

  async function execute(): Promise<{ uploaded: number; task: TaskRecord }> {
  const current = assertFileMutationAccess(user);
  const library = (await assertLibraryAccess(current, libraryId));
  const root = (await assertLibraryRootPath(library.root_path));
  let targetDir = root;
  let targetParentEntryId: string | undefined;
  if (parentId !== undefined && parentId !== null && parentId !== "") {
    const { entry } = (await assertEntryAccess(current, parentId, { libraryId, directory: true }));
    targetDir = (await resolveMutationPathWithinLibrary(root, buildRelativePathForEntry(getEntryById(entry.id)!)));
    targetParentEntryId = entry.id;
  }

  const uploadError = () => new AccessError("上传失败", 400);
  if (earlyFailure || input.destroyed || input.readableEnded) throw uploadError();
  let parser: ReturnType<typeof Busboy> & Writable;
  try {
    parser = Busboy({ headers }) as ReturnType<typeof Busboy> & Writable;
  } catch {
    throw uploadError();
  }
  await fs.promises.mkdir(targetDir, { recursive: true });
  if (earlyFailure || input.destroyed || input.readableEnded) throw uploadError();

  const createdPaths: string[] = [];
  const writes: Promise<void>[] = [];
  const active = new Set<{ file: Readable; output?: fs.WriteStream }>();
  let previousWrite = Promise.resolve();
  let failure: Error | undefined;
  let hasFile = false;
  let uploaded = 0;
  let rejectParsing: (error: Error) => void;
  const fail = (error?: unknown): void => {
    if (failure) return;
    failure = error instanceof AccessError ? error : uploadError();
    input.unpipe(parser);
    rejectParsing(failure);
    // Stop every in-flight write, including files already consumed by Busboy.
    for (const { file, output } of active) {
      file.destroy(failure);
      output?.destroy(failure);
    }
    parser.destroy(failure);
    // Leave an IncomingMessage's socket alive so its route can send an error.
    if (!input.destroyed) input.resume();
  };
  const parsing = new Promise<void>((resolve, reject) => {
    rejectParsing = reject;
    parser.once("finish", resolve);
    parser.once("close", () => {
      if (!parser.writableFinished) fail();
    });
  });
  const onInputClose = () => {
    if (!input.readableEnded) fail();
  };
  input.on("error", fail);
  input.on("aborted", fail);
  input.on("close", onInputClose);
  parser.on("error", fail);
  parser.on("file", async (_fieldname, file, info) => {
    file.on("error", fail);
    if (failure) {
      file.resume();
      return;
    }
    hasFile = true;
    let original = info.filename || "unnamed";
    const decoded = Buffer.from(original, "latin1").toString("utf8");
    if (decoded && !decoded.includes("�")) original = decoded;
    const base = original.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
    if (!base || base === "." || base === "..") {
      file.resume();
      fail();
      return;
    }

    const transfer: { file: Readable; output?: fs.WriteStream } = { file };
    active.add(transfer);
    // Queue files in request order; each promise includes async reservation,
    // streaming and descriptor close, so rollback waits for pending opens too.
    const write = previousWrite.then(async () => {
      let fd: number | undefined;
      try {
        if (failure) return;
        const ext = path.extname(base);
        const stem = path.basename(base, ext);
        let candidate = base;
        let destination: string;
        for (let index = 1; ; index += 1) {
          destination = await resolveMutationPathWithinLibrary(root, path.relative(root, path.join(targetDir, candidate)));
          if (failure) return;
          try {
            // Callback open returns a numeric descriptor owned by the stream.
            fd = await new Promise<number>((resolve, reject) => {
              fs.open(destination, "wx", (error, opened) => error ? reject(error) : resolve(opened));
            });
            createdPaths.push(destination);
            break;
          } catch (error: any) {
            if (error?.code !== "EEXIST") throw error;
            candidate = `${stem}(${index})${ext}`;
          }
        }
        if (failure) return;
        const output = fs.createWriteStream(destination, { fd, autoClose: true });
        transfer.output = output;
        fd = undefined;
        await pipeline(file, output);
        uploaded += 1;
      } catch (error) {
        fail(error);
      } finally {
        if (fd !== undefined) await new Promise<void>((resolve) => fs.close(fd!, () => resolve()));
        active.delete(transfer);
      }
    });
    previousWrite = write;
    writes.push(write);
  });

  try {
    input.pipe(parser);
    await parsing;
    // Parser completion only means it has consumed the request, not that files
    // have finished writing and closed. Indexing must wait for both.
    await Promise.all(writes);
    if (failure) throw failure;
    if (!hasFile) throw new AccessError("未收到任何文件", 400);
    const relativePath = path.relative(root, targetDir);
    const task = createTask({
      type: relativePath === "" ? TaskTypes.FILE_INDEX_LIBRARY : TaskTypes.FILE_INDEX_SINGLE,
      payload: relativePath === "" ? { libraryId } : { libraryId, relativePath, parentEntryId: targetParentEntryId },
      createdByUserId: current.id,
    });
    return { uploaded, task };
  } catch (error) {
    fail(error);
    await Promise.all(writes);
    // Only files exclusively created by this request may be removed.
    for (const created of createdPaths) await fs.promises.rm(created, { force: true });
    throw error;
  } finally {
    input.unpipe(parser);
    input.off("error", fail);
    input.off("aborted", fail);
    input.off("close", onInputClose);
  }
  }
};
