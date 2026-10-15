import { describe, expect, test } from "bun:test";
import { resolveBrowserLocation, restoreBrowserPath, shouldResetLibrary } from "../src/pages/home/fileBrowser/location";

const resolve = (query: string) => resolveBrowserLocation(new URLSearchParams(query));

describe("file browser URL state", () => {
  test("folder navigation, library changes and browser Back derive only from current URL", () => {
    expect(resolve("libraryId=2&parentId=first").currentParentId).toBe("first");
    expect(resolve("libraryId=2&parentId=newer").currentParentId).toBe("newer");
    expect(resolve("libraryId=3")).toEqual({ activeLibraryId: 3, currentParentId: null, isVirtualTags: false });
    expect(resolve("libraryId=2&parentId=first").currentParentId).toBe("first");
    expect(resolve("")).toEqual({ activeLibraryId: null, currentParentId: null, isVirtualTags: false });
  });
  test("virtual tags and invalid IDs never retain a folder", () => {
    expect(resolve("virtual=tags&libraryId=2&parentId=old")).toEqual({ activeLibraryId: null, currentParentId: null, isVirtualTags: true });
    for (const id of ["", "0", "-1", "NaN", "2oops", "1.5"]) {
      expect(resolve(`libraryId=${id}&parentId=old`).currentParentId).toBeNull();
      expect(resolve(`libraryId=${id}`).activeLibraryId).toBeNull();
    }
  });
  test("restore validates optional cached state without throwing", () => {
    for (const raw of [null, "{", "null", "[]", '{"libraryId":0}', '{"libraryId":"2"}']) {
      expect(restoreBrowserPath(raw)).toBeNull();
    }
    expect(restoreBrowserPath('{"libraryId":2,"parentId":"folder"}')).toEqual({ libraryId: "2", parentId: "folder" });
    expect(restoreBrowserPath('{"libraryId":2,"parentId":null}')).toEqual({ libraryId: "2" });
  });
});

 test("only a successful library fetch can invalidate a deep link", () => {
   expect(shouldResetLibrary(2, [], true, null)).toBe(false);
   expect(shouldResetLibrary(2, [], false, "Network error")).toBe(false);
   expect(shouldResetLibrary(2, [], false, null)).toBe(true);
   expect(shouldResetLibrary(2, [{ id: 2 }], false, null)).toBe(false);
   expect(shouldResetLibrary(null, [], false, null)).toBe(false);
 });
