import jwt from "jsonwebtoken";
import type { AuthUser } from "./roles";

// JWT 秘钥，生产环境建议通过环境变量配置
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayloadUser extends AuthUser {
  // 这里可以扩展额外字段
}

// 签发用户 JWT
export const signUserToken = (user: AuthUser): string => {
  const payload: JwtPayloadUser = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 校验并解析 JWT
export const verifyUserToken = (token: string): JwtPayloadUser | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded as JwtPayloadUser;
  } catch {
    return null;
  }
};
