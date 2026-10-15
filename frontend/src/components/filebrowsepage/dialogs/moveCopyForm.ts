import type { CopyEntryParams, FileEntry } from "@/lib/api/files";

/** Credentials stay scoped to their exact source entry or destination folder. */
export function moveCopyParams(
  entryId: string,
  targetParentId: string | null,
  sourcePasswords: Record<string, string>,
  targetPasswords: Record<string, string>,
  newName?: string,
): CopyEntryParams {
  return {
    targetParentId,
    newName,
    sourcePassword: sourcePasswords[entryId] || undefined,
    targetPassword: targetParentId ? targetPasswords[targetParentId] || undefined : undefined,
  };
}

/** Keep acknowledged submissions on retry after a later item is rejected. */
export async function submitMoveCopyEntries(
  entries: FileEntry[],
  submitted: Set<string>,
  submit: (entry: FileEntry) => Promise<void>,
): Promise<void> {
  for (const entry of entries) {
    if (submitted.has(entry.id)) continue;
    await submit(entry);
    submitted.add(entry.id);
  }
}
