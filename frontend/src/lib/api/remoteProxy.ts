/**
 * 远程代理 API
 */

import { apiClient } from "./client";

// 远程客户端信息
export interface RemoteClient {
  id: string;
  name: string;
  connectedAt: string;
  lastHeartbeat: string;
}

// 获取已连接的远程客户端列表
export const getRemoteClients = async (): Promise<{ clients: RemoteClient[] }> => {
  return apiClient.get<{ clients: RemoteClient[] }>("/remote-proxy/clients");
};

// 断开指定客户端
export const disconnectRemoteClient = async (clientId: string): Promise<{ message: string }> => {
  return apiClient.delete<{ message: string }>(`/remote-proxy/clients/${clientId}`);
};

// 代理请求到远程客户端
export const proxyRequest = async <T = any>(
  clientId: string,
  method: string,
  path: string,
  body?: any
): Promise<T> => {
  const url = `/remote-proxy/clients/${clientId}/proxy${path}`;
  
  switch (method.toUpperCase()) {
    case "GET":
      return apiClient.get<T>(url);
    case "POST":
      return apiClient.post<T>(url, body);
    case "PUT":
      return apiClient.put<T>(url, body);
    case "DELETE":
      return apiClient.delete<T>(url);
    case "PATCH":
      return apiClient.request<T>(url, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
    default:
      return apiClient.get<T>(url);
  }
};

// 获取远程客户端的文件库列表
export const getRemoteLibraries = async (clientId: string) => {
  return proxyRequest<{ items: any[] }>(clientId, "GET", "/api/file-libraries");
};

// 获取远程文件库目录内容
export const getRemoteEntries = async (
  clientId: string,
  libraryId: number,
  parentId?: string
) => {
  const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
  return proxyRequest<{ items: any[] }>(
    clientId,
    "GET",
    `/api/files/library/${libraryId}/entries${query}`
  );
};

// 获取远程文件信息
export const getRemoteEntry = async (clientId: string, entryId: string) => {
  return proxyRequest<{ entry: any }>(clientId, "GET", `/api/entries/${entryId}`);
};
