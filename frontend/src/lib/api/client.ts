export interface ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

// 计算后端 API 的基础地址：
// 1. 若配置了 VITE_API_BASE_URL，则优先使用（适合生产或代理场景）；
// 2. 否则在浏览器环境下，根据当前页面 hostname + 固定端口 3001 生成；
//    这样前端在局域网中通过不同 IP 访问时，仍能自动指向同一台后端主机；
// 3. 非浏览器环境或兜底场景下，退回 localhost。
const getBaseUrl = () => {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envBase && envBase.length > 0) {
    return envBase.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3001/api`;
  }

  return "http://localhost:3001/api";
};

export const buildApiUrl = (path: string) => {
  const base = getBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const parseJsonSafe = (text: string | null): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});

  const hasBody = init.body !== undefined;
  if (hasBody && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const res = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  const text = await res.text();
  const data = parseJsonSafe(text);

  if (!res.ok) {
    const message =
      typeof (data as any)?.message === "string" ? (data as any).message : "请求失败";
    const error: ApiError = Object.assign(new Error(message), {
      status: res.status,
      statusText: res.statusText,
      body: data,
    });
    throw error;
  }

  return data as T;
}

export const apiClient = {
  request,
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body:
        body !== undefined && !(body instanceof FormData)
          ? (JSON.stringify(body) as BodyInit)
          : ((body as BodyInit | undefined) ?? undefined),
    }),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PUT",
      body:
        body !== undefined && !(body instanceof FormData)
          ? (JSON.stringify(body) as BodyInit)
          : ((body as BodyInit | undefined) ?? undefined),
    }),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "DELETE",
    }),
};
