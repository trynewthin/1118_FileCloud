import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { FileLibrary } from "@/lib/api/fileLibraries";
import { LAST_PATH_CACHE_KEY, resolveBrowserLocation, restoreBrowserPath, shouldResetLibrary } from "./location";

// URL navigation, one-time path restoration and persistence live together so
// browser Back and an explicit root navigation cannot revive stale folder state.
export function useBrowserLocation(libraries: FileLibrary[], loading: boolean, error: string | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = resolveBrowserLocation(searchParams);
  const { activeLibraryId, currentParentId } = location;
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (searchParams.has("libraryId") || searchParams.has("parentId") || searchParams.has("virtual")) return;
    try {
      const cached = restoreBrowserPath(localStorage.getItem(LAST_PATH_CACHE_KEY));
      if (cached) setSearchParams(cached, { replace: true });
    } catch {
      // Storage is optional, for example in a restricted browser session.
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (shouldResetLibrary(activeLibraryId, libraries, loading, error)) {
      setSearchParams({}, { replace: true });
    }
  }, [loading, error, libraries, activeLibraryId, setSearchParams]);

  useEffect(() => {
    if (loading) return;
    try {
      localStorage.setItem(LAST_PATH_CACHE_KEY, JSON.stringify({ libraryId: activeLibraryId, parentId: currentParentId }));
    } catch {
      // Storage is optional.
    }
  }, [loading, activeLibraryId, currentParentId]);

  return { ...location, setSearchParams };
}
