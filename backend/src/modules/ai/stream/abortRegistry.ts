/**
 * 流式请求终止注册表
 *
 * 用于：前端通过 requestId 请求后端终止正在进行的流式对话。
 * 注意：这是进程内内存状态，服务重启后会丢失。
 */

export interface StreamAbortEntry {
  requestId: string;
  conversationId: number;
  userId: number;
  controller: AbortController;
  createdAt: number;
}

const registry = new Map<string, StreamAbortEntry>();

export function registerStreamAbort(entry: Omit<StreamAbortEntry, "createdAt">): void {
  registry.set(entry.requestId, {
    ...entry,
    createdAt: Date.now(),
  });
}

export function unregisterStreamAbort(requestId: string): void {
  registry.delete(requestId);
}

export function abortStreamRequest(input: {
  requestId: string;
  conversationId: number;
  userId: number;
}): { ok: boolean; reason?: "not_found" | "forbidden" } {
  const entry = registry.get(input.requestId);
  if (!entry) {
    return { ok: false, reason: "not_found" };
  }

  if (entry.conversationId !== input.conversationId || entry.userId !== input.userId) {
    return { ok: false, reason: "forbidden" };
  }

  try {
    entry.controller.abort();
  } finally {
    registry.delete(input.requestId);
  }

  return { ok: true };
}

export function hasStreamRequest(requestId: string): boolean {
  return registry.has(requestId);
}
