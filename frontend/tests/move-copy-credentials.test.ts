import { describe, expect, spyOn, test } from "bun:test";
import { apiClient } from "../src/lib/api/client";
import { copyEntry, moveEntry, listEntries, getEntry, type FileEntry } from "../src/lib/api/files";
import { moveCopyParams, submitMoveCopyEntries } from "../src/components/filebrowsepage/dialogs/moveCopyForm";

const sourcePasswords = { first: "source-one", second: "source-two" };
const targetPasswords = { destination: "target-one", other: "target-two" };

describe("move/copy credential wiring", () => {
  test("entry and destination credentials stay isolated through navigation and batch construction", () => {
    expect(moveCopyParams("first", "destination", sourcePasswords, targetPasswords, "copy.txt"))
      .toEqual({ targetParentId: "destination", sourcePassword: "source-one", targetPassword: "target-one", newName: "copy.txt" });
    expect(moveCopyParams("second", "other", sourcePasswords, targetPasswords))
      .toEqual({ targetParentId: "other", sourcePassword: "source-two", targetPassword: "target-two", newName: undefined });
    const missing = moveCopyParams("new-source", "new-target", sourcePasswords, targetPasswords);
    expect(missing.sourcePassword).toBeUndefined(); expect(missing.targetPassword).toBeUndefined();
    const root = moveCopyParams("first", null, sourcePasswords, targetPasswords);
    expect(root.sourcePassword).toBe("source-one"); expect(root.targetPassword).toBeUndefined();
    expect(root).not.toHaveProperty("password");
  });

  test("batch rejects failures and retry skips entries already acknowledged", async () => {
    const entries = [{ id: "first" }, { id: "second" }] as FileEntry[];
    const submitted = new Set<string>();
    const calls: string[] = [];
    await expect(submitMoveCopyEntries(entries, submitted, async entry => {
      calls.push(entry.id);
      if (entry.id === "second") throw new Error("wrong source password");
    })).rejects.toThrow("wrong source password");
    expect([...submitted]).toEqual(["first"]);
    await submitMoveCopyEntries(entries, submitted, async entry => { calls.push(entry.id); });
    expect(calls).toEqual(["first", "second", "second"]);
    expect([...submitted]).toEqual(["first", "second"]);
  });
});

test("both API clients send the split fields in the POST body without rewriting legacy fallback", async () => {
  const post = spyOn(apiClient, "post");
  try {
  post.mockResolvedValue({ task: { id: 1 } });
  const params = moveCopyParams("first", "destination", sourcePasswords, targetPasswords, "new.txt");
  await moveEntry("first", params);
  expect(post).toHaveBeenLastCalledWith("/files/entries/first/move", params);
  await copyEntry("first", params);
  expect(post).toHaveBeenLastCalledWith("/files/entries/first/copy", params);
  const legacy = { targetParentId: "destination", password: "legacy", sourcePassword: null };
  await moveEntry("first", legacy);
  expect(post).toHaveBeenLastCalledWith("/files/entries/first/move", legacy);
  } finally {
    post.mockRestore();
  }
});

test("credentialed destination reads use JSON POST bodies and unprotected reads retain GET", async () => {
  const post = spyOn(apiClient, "post").mockResolvedValue({});
  const get = spyOn(apiClient, "get").mockResolvedValue({});
  try {
    await getEntry("destination", "target-secret");
    expect(post).toHaveBeenLastCalledWith("/files/entries/destination", { password: "target-secret" });
    await listEntries({ libraryId: 1, parentId: "destination", password: "target-secret" });
    expect(post).toHaveBeenLastCalledWith("/files/library/1/entries", { parentId: "destination", password: "target-secret" });
    await getEntry("destination");
    expect(get).toHaveBeenLastCalledWith("/files/entries/destination");
    await listEntries({ libraryId: 1, parentId: "destination" });
    expect(get).toHaveBeenLastCalledWith("/files/library/1/entries?parentId=destination");
  } finally {
    post.mockRestore(); get.mockRestore();
  }
});
