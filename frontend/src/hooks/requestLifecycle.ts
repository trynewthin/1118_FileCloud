/** Tracks which resource and request may publish a result into a mounted hook. */
export function createRequestLifecycle<Source>() {
  let source: Source | undefined;
  let mounted = false;
  let generation = 0;

  const accepts = (candidate: Source) => mounted && source === candidate;

  return {
    accepts,
    activate(nextSource: Source) {
      generation++;
      source = nextSource;
      mounted = true;
    },
    deactivate() {
      mounted = false;
      generation++;
    },
    begin(candidate: Source): number | null {
      return accepts(candidate) ? ++generation : null;
    },
    isCurrent(request: number) {
      return mounted && request === generation;
    },
  };
}
