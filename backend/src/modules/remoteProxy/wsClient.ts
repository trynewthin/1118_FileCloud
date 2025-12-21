/**
 * WebSocket 客户端
 * 
 * 当后端运行在"客户端模式"时，通过 WebSocket 连接到主服务器，
 * 接收主服务器转发的 HTTP 请求并返回响应。
 */

import WebSocket from "ws";
import type { Application } from "express";
import { createLogger } from "../../core/logger/index.ts";
import {
  getRemoteClientServerUrl,
  getRemoteClientId,
  getRemoteClientName,
  getRemoteClientSecret,
} from "../../core/config/paths.ts";
import type { RequestMessage, ResponseMessage, AuthMessage } from "./types.ts";

const logger = createLogger("RemoteClient");

let ws: WebSocket | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isConnecting = false;
let app: Application | null = null;

const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_INTERVAL = 5000;

// 初始化客户端模式
export const initWebSocketClient = (expressApp: Application) => {
  app = expressApp;
  connect();
};

// 连接到主服务器
const connect = () => {
  if (isConnecting || ws?.readyState === WebSocket.OPEN) {
    return;
  }

  const serverUrl = getRemoteClientServerUrl();
  if (!serverUrl) {
    logger.error("未配置主服务器地址 (REMOTE_CLIENT_SERVER_URL)");
    return;
  }

  isConnecting = true;
  logger.info(`正在连接到主服务器: ${serverUrl}`);

  try {
    ws = new WebSocket(serverUrl);

    ws.on("open", () => {
      isConnecting = false;
      logger.info("WebSocket 已连接，发送认证...");
      sendAuth();
    });

    ws.on("message", (data: Buffer) => {
      handleMessage(data.toString());
    });

    ws.on("close", (code: number, reason: Buffer) => {
      isConnecting = false;
      logger.warn(`连接已断开: ${code} ${reason.toString()}`);
      cleanup();
      scheduleReconnect();
    });

    ws.on("error", (err: Error) => {
      isConnecting = false;
      logger.error("连接错误:", err.message);
    });
  } catch (err: any) {
    isConnecting = false;
    logger.error("连接失败:", err.message);
    scheduleReconnect();
  }
};

// 发送认证消息
const sendAuth = () => {
  const authMessage: AuthMessage = {
    type: "auth",
    clientId: getRemoteClientId(),
    clientName: getRemoteClientName(),
    secretKey: getRemoteClientSecret(),
  };
  send(authMessage);
};

// 发送消息
const send = (message: any) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
};

// 处理消息
const handleMessage = async (data: string) => {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case "auth_result":
        if (message.success) {
          logger.info("认证成功，已连接到主服务器");
          startHeartbeat();
        } else {
          logger.error("认证失败:", message.message);
          ws?.close();
        }
        break;

      case "request":
        await handleRequest(message as RequestMessage);
        break;

      default:
        logger.debug(`未知消息类型: ${message.type}`);
    }
  } catch (err) {
    logger.error("解析消息失败:", err);
  }
};

// 处理 HTTP 请求转发
const handleRequest = async (message: RequestMessage) => {
  if (!app) {
    sendResponse(message.id, false, undefined, "应用未初始化");
    return;
  }

  const { id, action, payload } = message;

  try {
    // action 格式: "METHOD /path"，如 "GET /api/file-libraries"
    const [method, path] = action.split(" ");
    if (!method || !path) {
      sendResponse(id, false, undefined, "无效的请求格式");
      return;
    }

    // 模拟 HTTP 请求
    const result = await simulateHttpRequest(method, path, payload);
    sendResponse(id, true, result);
  } catch (err: any) {
    sendResponse(id, false, undefined, err.message || "请求处理失败");
  }
};

// 模拟 HTTP 请求到本地 Express 应用
const simulateHttpRequest = async (
  method: string,
  path: string,
  payload: any
): Promise<any> => {
  return new Promise((resolve, reject) => {
    // 创建模拟的请求和响应对象
    const mockReq: any = {
      method: method.toUpperCase(),
      url: path,
      path: path.split("?")[0],
      query: parseQuery(path),
      body: payload?.body || {},
      headers: {
        ...payload?.headers,
        // 添加内部标识，表示这是远程代理请求
        "x-remote-proxy": "true",
      },
      params: {},
      // 模拟用户信息（从 payload 中获取）
      user: payload?.user,
    };

    let responseData: any = null;
    let statusCode = 200;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: any) => {
        responseData = data;
        resolve({ status: statusCode, data: responseData });
      },
      send: (data: any) => {
        responseData = data;
        resolve({ status: statusCode, data: responseData });
      },
      sendStatus: (code: number) => {
        statusCode = code;
        resolve({ status: statusCode });
      },
      setHeader: () => mockRes,
      header: () => mockRes,
      end: () => {
        resolve({ status: statusCode, data: responseData });
      },
    };

    // 使用 Express 的路由处理
    try {
      (app as any)(mockReq, mockRes, (err: any) => {
        if (err) {
          reject(err);
        } else {
          // 如果没有路由匹配
          reject(new Error("路由未找到"));
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

// 解析查询字符串
const parseQuery = (path: string): Record<string, string> => {
  const query: Record<string, string> = {};
  const queryStart = path.indexOf("?");
  if (queryStart === -1) return query;

  const queryString = path.slice(queryStart + 1);
  for (const pair of queryString.split("&")) {
    const [key, value] = pair.split("=");
    if (key) {
      query[key] = value ? decodeURIComponent(value) : "";
    }
  }
  return query;
};

// 发送响应
const sendResponse = (id: string, success: boolean, data?: any, error?: string) => {
  const response: ResponseMessage = {
    type: "response",
    id,
    success,
    data,
    error,
  };
  send(response);
};

// 启动心跳
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    send({ type: "heartbeat" });
  }, HEARTBEAT_INTERVAL);
};

// 停止心跳
const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

// 计划重连
const scheduleReconnect = () => {
  if (reconnectTimer) return;

  logger.info(`${RECONNECT_INTERVAL / 1000} 秒后重连...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_INTERVAL);
};

// 清理资源
const cleanup = () => {
  stopHeartbeat();
};

// 断开连接
export const disconnectClient = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  cleanup();
  if (ws) {
    ws.close();
    ws = null;
  }
};
