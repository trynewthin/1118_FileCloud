/**
 * 远程代理模块类型定义
 */

// 远程客户端信息
export interface RemoteClient {
  id: string;           // 客户端唯一标识
  name: string;         // 客户端名称（用户设置）
  connectedAt: Date;    // 连接时间
  lastHeartbeat: Date;  // 最后心跳时间
}

// WebSocket 消息类型
export type MessageType = 
  | "auth"           // 认证
  | "auth_result"    // 认证结果
  | "heartbeat"      // 心跳
  | "request"        // 请求（服务器 -> 客户端）
  | "response"       // 响应（客户端 -> 服务器）
  | "error";         // 错误

// 基础消息结构
export interface BaseMessage {
  type: MessageType;
  id?: string;       // 消息ID，用于请求-响应配对
}

// 认证消息
export interface AuthMessage extends BaseMessage {
  type: "auth";
  clientId: string;  // 客户端ID
  clientName: string; // 客户端名称
  secretKey: string; // 认证密钥
}

// 认证结果
export interface AuthResultMessage extends BaseMessage {
  type: "auth_result";
  success: boolean;
  message?: string;
}

// 心跳消息
export interface HeartbeatMessage extends BaseMessage {
  type: "heartbeat";
}

// 请求消息（服务器发给客户端）
export interface RequestMessage extends BaseMessage {
  type: "request";
  id: string;
  action: RemoteAction;
  payload: any;
}

// 响应消息（客户端发给服务器）
export interface ResponseMessage extends BaseMessage {
  type: "response";
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

// 远程操作类型（HTTP 请求格式：METHOD /path）
export type RemoteAction = string;

// 联合消息类型
export type ProxyMessage = 
  | AuthMessage 
  | AuthResultMessage 
  | HeartbeatMessage 
  | RequestMessage 
  | ResponseMessage;
