/** Read error details without trusting arbitrary caught values or response bodies. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error &&
      typeof error.message === "string") return error.message || fallback;
  return fallback;
}

export function getErrorStatus(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error &&
    typeof error.status === "number" ? error.status : undefined;
}

export function isAbortError(error: unknown): boolean {
  return (typeof error === "object" && error !== null && "name" in error &&
    error.name === "AbortError") || getErrorMessage(error, "").includes("aborted");
}
