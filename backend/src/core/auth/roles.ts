export type UserRole = "admin" | "user";

// 代表一个已经通过认证的用户信息
export interface AuthUser {
  id: number;
  username: string | null;
  role: UserRole;
}

// 权限级别枚举，用于底层权限判断（系统 / 管理员 / 普通用户）
export enum PermissionLevel {
  System = "system",
  Admin = "admin",
  User = "user",
}
