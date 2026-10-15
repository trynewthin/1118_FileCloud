// Async filesystem operations yield between path checks, disk changes and DB
// writes. Serialize each library's commands/uploads/scans within this process.
// This is not a cross-process lock or protection against external filesystem edits.
const mutationTails = new Map<number, Promise<void>>();

export async function withLibraryMutation<T>(libraryId: number, operation: () => Promise<T>): Promise<T> {
  const previous = mutationTails.get(libraryId) ?? Promise.resolve();
  let release!: () => void;
  const tail = new Promise<void>(resolve => { release = resolve; });
  mutationTails.set(libraryId, tail);
  await previous;
  try { return await operation(); }
  finally {
    release();
    if (mutationTails.get(libraryId) === tail) mutationTails.delete(libraryId);
  }
}
