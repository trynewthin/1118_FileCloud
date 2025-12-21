/**
 * 远程代理 API 路由
 * 
 * 提供远程客户端管理和请求转发功能
 */

import express from "express";
import { authenticate, requirePermission } from "../../core/auth/permission.ts";
import { PermissionLevel } from "../../core/auth/roles.ts";
import { getConnectedClients, disconnectClient, sendRequest, isClientOnline } from "./wsServer.ts";

const router = express.Router();

// 获取已连接的远程客户端列表
router.get(
  "/clients",
  authenticate,
  requirePermission(PermissionLevel.User),
  (_req, res) => {
    const clients = getConnectedClients();
    return res.json({ clients });
  }
);

// 断开指定客户端
router.delete(
  "/clients/:clientId",
  authenticate,
  requirePermission(PermissionLevel.Admin),
  (req, res) => {
    const clientId = req.params.clientId!;
    const success = disconnectClient(clientId);
    if (success) {
      return res.json({ message: "已断开" });
    }
    return res.status(404).json({ message: "客户端不存在" });
  }
);

// 通用代理路由：转发请求到远程客户端
// 格式: /clients/:clientId/proxy/api/...
router.use(
  "/clients/:clientId/proxy",
  authenticate,
  requirePermission(PermissionLevel.User),
  async (req, res, next) => {
    const clientId = req.params.clientId!;
    
    // 检查客户端是否在线
    if (!isClientOnline(clientId)) {
      return res.status(503).json({ message: "远程客户端不在线" });
    }

    // 构建转发的路径
    const proxyPath = req.url; // req.url 包含 /proxy 后面的部分
    const action = `${req.method} ${proxyPath}`;

    try {
      const data = await sendRequest(clientId, action, {
        body: req.body,
        query: req.query,
        headers: {
          "content-type": req.headers["content-type"],
        },
        user: req.user, // 传递用户信息
      });

      // 返回远程客户端的响应
      if (data.status) {
        res.status(data.status);
      }
      if (data.data !== undefined) {
        return res.json(data.data);
      }
      return res.end();
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "远程请求失败" });
    }
  }
);

export { router as remoteProxyRouter };
