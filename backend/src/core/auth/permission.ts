import type { Request, Response, NextFunction } from "express";
import { PermissionLevel } from "./roles";
import { verifyUserToken } from "./jwt";

// 在 Request 上扩展一个 user 字段保存认证后的用户信息
declare module "express-serve-static-core" {
  interface Request {
    // 当前登录用户信息，未登录则为 undefined
    user?: {
      id: number;
      username: string | null;
      role: "admin" | "user";
    };
  }
}

// 从 Authorization 头中解析并校验 JWT，挂载 req.user
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({ message: "未提供身份令牌" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "身份令牌格式错误" });
  }

  const payload = verifyUserToken(token);
  if (!payload) {
    return res.status(401).json({ message: "身份令牌无效或已过期" });
  }

  req.user = {
    id: payload.id,
    username: payload.username,
    role: payload.role,
  };

  next();
};

// 底层权限校验中间件：根据所需权限级别判断当前请求是否有权执行
// 注意：该中间件只在接口层（路由层）使用，服务层不直接依赖权限判断。
export const requirePermission = (required: PermissionLevel) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const systemKey = process.env.SYSTEM_KEY;
    const headerKey = req.headers["x-system-key"];

    // 判断当前请求是否具备系统级权限
    const hasSystemPermission = Boolean(systemKey && headerKey === systemKey);

    // 如果要求系统级权限，则只有系统密钥通过才能继续
    if (required === PermissionLevel.System) {
      if (hasSystemPermission) {
        return next();
      }
      return res.status(403).json({ message: "系统级操作未授权" });
    }

    const user = req.user;

    // 既没有系统密钥、也没有登录用户，视为未认证
    if (!user && !hasSystemPermission) {
      return res.status(401).json({ message: "未登录或会话已失效" });
    }

    // 定义包含式权限等级：system > admin > user
    const levelRank = (level: PermissionLevel): number => {
      switch (level) {
        case PermissionLevel.User:
          return 1;
        case PermissionLevel.Admin:
          return 2;
        case PermissionLevel.System:
          return 3;
      }
    };

    // 当前请求的实际权限等级
    let currentRank = 0;

    if (hasSystemPermission) {
      currentRank = levelRank(PermissionLevel.System);
    } else if (user) {
      currentRank = user.role === "admin" ? levelRank(PermissionLevel.Admin) : levelRank(PermissionLevel.User);
    }

    const requiredRank = levelRank(required);

    if (currentRank >= requiredRank) {
      return next();
    }

    // 已认证但等级不足
    return res.status(403).json({ message: "权限不足" });
  };
};
