/**
 * Express 应用配置
 * 
 * 仅负责：
 * 1. 创建 Express 实例
 * 2. 配置中间件（JSON 解析、CORS 等）
 * 3. 健康检查端点
 * 
 * 路由挂载由 ModuleLoader 统一处理
 */

import express from "express";
import type { Request, Response } from "express";

const app = express();

// JSON 和 URL 编码解析
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 配置
app.use((req, res, next) => {
  const origin = req.headers.origin ?? "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-fs-access-key",
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// 健康检查端点（不通过模块加载器，直接挂载）
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

export { app };
