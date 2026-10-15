/** Sequential delayed polling: slow storage never creates overlapping scans.
 * Stop invalidates an in-flight scan before awaiting it, preventing late writes. */
export const createPollingLoop = (
  check: (isCurrent: () => boolean) => Promise<void>,
  onError: (error: unknown) => void,
) => {
  let generation = 0;
  let active = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  const start = (intervalMs: number): void => {
    if (!Number.isFinite(intervalMs) || intervalMs < 1) throw new Error("Polling interval must be positive");
    if (active) return;
    if (stopping) throw new Error("Polling loop is stopping");
    active = true;
    const current = ++generation;
    const isCurrent = () => active && current === generation;
    const run = () => {
      pending = Promise.resolve().then(() => check(isCurrent)).catch(onError).finally(() => {
        pending = undefined;
        if (isCurrent()) {
          timer = setTimeout(run, intervalMs);
          timer.unref?.();
        }
      });
    };
    run();
  };
  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    active = false;
    generation++;
    if (timer) clearTimeout(timer);
    timer = undefined;
    stopping = (pending ?? Promise.resolve()).finally(() => { stopping = undefined; });
    return stopping;
  };
  return { start, stop, isRunning: () => active };
};
