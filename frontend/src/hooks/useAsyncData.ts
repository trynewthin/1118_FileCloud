import { createRequestLifecycle } from "./requestLifecycle";
import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/api/errors";

/** Load a resource, ignoring responses superseded by a reload or unmount. */
export function useAsyncData<T>(
  initialData: T,
  fetchData: () => Promise<T>,
  fallbackError: string,
  auto = true,
) {
  const [snapshot, setSnapshot] = useState({ data: initialData as T | null, source: fetchData, loading: auto, error: null as string | null });
  const lifecycleRef = useRef(createRequestLifecycle<() => Promise<T>>());

  const fetchLatest = useCallback(async () => {
    const request = lifecycleRef.current.begin(fetchData);
    if (request === null) return;
    try {
      const data = await fetchData();
      if (lifecycleRef.current.isCurrent(request)) {
        setSnapshot({ data, source: fetchData, loading: false, error: null });
      }
    } catch (error) {
      if (lifecycleRef.current.isCurrent(request)) {
        setSnapshot((previous) => ({
          ...previous, data: previous.source === fetchData ? previous.data : null,
          source: fetchData, loading: false, error: getErrorMessage(error, fallbackError),
        }));
      }
    }
  }, [fetchData, fallbackError]);

  const load = useCallback(async (silent = false) => {
    if (!lifecycleRef.current.accepts(fetchData)) return;
    if (!silent) setSnapshot((previous) => ({ ...previous, loading: true, error: null }));
    await fetchLatest();
  }, [fetchLatest, fetchData]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    lifecycle.activate(fetchData);
    if (auto) void fetchLatest();
    return () => {
      lifecycle.deactivate();
    };
  }, [auto, fetchLatest, fetchData]);

  // A new resource is pending immediately; do not render the previous directory
  // beneath a newly selected URL while its request is still in flight.
  const current = snapshot.source === fetchData;
  const state = {
    ...(current && snapshot.data !== null ? snapshot.data : initialData),
    loading: current ? snapshot.loading : auto,
    error: current ? snapshot.error : null,
  };
  return { state, load };
}
