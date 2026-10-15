export const LAST_PATH_CACHE_KEY = "file_browser_last_path";

export function resolveBrowserLocation(searchParams: URLSearchParams) {
  const virtual = searchParams.get("virtual");
  const parsedId = Number(searchParams.get("libraryId"));
  const activeLibraryId = !virtual && Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
  return {
    activeLibraryId,
    currentParentId: activeLibraryId ? searchParams.get("parentId") || null : null,
    isVirtualTags: virtual === "tags",
  };
}

export function restoreBrowserPath(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("libraryId" in value)) return null;
    const id = value.libraryId;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) return null;
    const params: Record<string, string> = { libraryId: String(id) };
    if ("parentId" in value && typeof value.parentId === "string" && value.parentId) {
      params.parentId = value.parentId;
    }
    return params;
  } catch {
    return null;
  }
}

export function shouldResetLibrary(
  activeLibraryId: number | null,
  libraries: ReadonlyArray<{ id: number }>,
  loading: boolean,
  error: string | null,
): boolean {
  return !loading && !error && activeLibraryId !== null && !libraries.some((library) => library.id === activeLibraryId);
}
