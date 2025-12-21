/**
 * WebSocket 服务端
 * 管理远程客户端连接
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { createLogger } from "../../core/logger/index.ts";
import { getRemoteProxyKey } from "../../core/config/paths.ts";
import type {
  RemoteClient,
  ProxyMessage,
  AuthMessage,
  RequestMessage,
  ResponseMessage,
} from "./types.ts";

const logger = createLogger("RemoteProxy");

// 已连接的客户端
const clients = new Map<string, {
  ws: WebSocket;
  info: RemoteClient;
}>();

// 等待响应的请求
const pendingRequests = new Map<string, {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

let wss: WebSocketServer | null = null;

// 生成唯一ID
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

// 初始化 WebSocket 服务
export const initWebSocketServer = (server: Server) => {
  wss = new WebSocketServer({ server, path: "/ws/remote-proxy" });

  wss.on("connection", (ws: WebSocket) => {
    let clientId: string | null = null;
    let authenticated = false;

    logger.debug("新的 WebSocket 连接");

    // 设置认证超时
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        logger.warn("客户端认证超时，断开连接");
        ws.close(4001, "认证超时");
      }
    }, 10000);

    ws.on("message", (data: Buffer) => {
      try {
        const message: ProxyMessage = JSON.parse(data.toString());

        // 未认证时只接受认证消息
        if (!authenticated) {
          if (message.type === "auth") {
            handleAuth(ws, message as AuthMessage, authTimeout).then((id) => {
              if (id) {
                clientId = id;
                authenticated = true;
              }
            });
          }
          return;
        }

        // 已认证，处理其他消息
        switch (message.type) {
          case "heartbeat":
            handleHeartbeat(clientId!);
            break;
          case "response":
            handleResponse(message as ResponseMessage);
            break;
          default:
            logger.warn(`未知消息类型: ${message.type}`);
        }
      } catch (err) {
        logger.error("解析消息失败", err);
      }
    });

    ws.on("close", () => {
      clearTimeout(authTimeout);
      if (clientId) {
        clients.delete(clientId);
        logger.info(`客户端断开: ${clientId}`);
      }
    });

    ws.on("error", (err: Error) => {
      logger.error("WebSocket 错误", err);
    });
  });

  logger.info("WebSocket 服务已启动，路径: /ws/remote-proxy");
};

// 处理认证
const handleAuth = async (
  ws: WebSocket,
  message: AuthMessage,
  authTimeout: NodeJS.Timeout
): Promise<string | null> => {
  const configuredKey = getRemoteProxyKey();

  // 验证密钥
  if (!configuredKey || message.secretKey !== configuredKey) {
    ws.send(JSON.stringify({
      type: "auth_result",
      success: false,
      message: "认证失败：密钥错误",
    }));
    ws.close(4003, "认证失败");
    return null;
  }

  clearTimeout(authTimeout);

  const clientId = message.clientId || generateId();

  // 如果已有同ID连接，断开旧连接
  if (clients.has(clientId)) {
    const old = clients.get(clientId)!;
    old.ws.close(4002, "被新连接替代");
    clients.delete(clientId);
  }

  // 保存客户端信息
  clients.set(clientId, {
    ws,
    info: {
      id: clientId,
      name: message.clientName || "未命名",
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    },
  });

  ws.send(JSON.stringify({
    type: "auth_result",
    success: true,
    message: "认证成功",
  }));

  logger.info(`客户端已连接: ${clientId} (${message.clientName})`);
  return clientId;
};

// 处理心跳
const handleHeartbeat = (clientId: string) => {
  const client = clients.get(clientId);
  if (client) {
    client.info.lastHeartbeat = new Date();
  }
};

// 处理响应
const handleResponse = (message: ResponseMessage) => {
  const pending = pendingRequests.get(message.id);
  if (!pending) {
    logger.warn(`收到未知请求ID的响应: ${message.id}`);
    return;
  }

  clearTimeout(pending.timeout);
  pendingRequests.delete(message.id);

  if (message.success) {
    pending.resolve(message.data);
  } else {
    pending.reject(new Error(message.error || "远程操作失败"));
  }
};

// 发送请求到远程客户端
export const sendRequest = <T = any>(
  clientId: string,
  action: RequestMessage["action"],
  payload: any,
  timeoutMs = 30000
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const client = clients.get(clientId);
    if (!client) {
      reject(new Error("客户端未连接"));
      return;
    }

    const requestId = generateId();
    const message: RequestMessage = {
      type: "request",
      id: requestId,
      action,
      payload,
    };

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("请求超时"));
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    client.ws.send(JSON.stringify(message));
  });
};

// 获取已连接的客户端列表
export const getConnectedClients = (): RemoteClient[] => {
  return Array.from(clients.values()).map((c) => c.info);
};

// 检查客户端是否在线
export const isClientOnline = (clientId: string): boolean => {
  return clients.has(clientId);
};

// 断开指定客户端
export const disconnectClient = (clientId: string): boolean => {
  const client = clients.get(clientId);
  if (client) {
    client.ws.close(4000, "服务器主动断开");
    clients.delete(clientId);
    return true;
  }
  return false;
};
