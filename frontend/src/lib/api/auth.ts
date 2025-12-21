import { apiClient, setAuthToken } from "./client";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

// 用户名 + 密码登录
export const loginWithPassword = async (
  username: string,
  password: string,
): Promise<AuthResponse> => {
  const data = await apiClient.post<AuthResponse>("/auth/login", {
    username,
    password,
  });
  setAuthToken(data.token);
  return data;
};

// 密钥登录
export const loginWithSecret = async (secret: string): Promise<AuthResponse> => {
  const data = await apiClient.post<AuthResponse>("/auth/login", { secret });
  setAuthToken(data.token);
  return data;
};

// 用户注册
export const register = async (
  username: string,
  password: string,
): Promise<AuthResponse> => {
  const data = await apiClient.post<AuthResponse>("/auth/register", {
    username,
    password,
  });
  setAuthToken(data.token);
  return data;
};

// 获取当前用户信息
export const getMe = async (): Promise<AuthUser> => {
  return apiClient.get<AuthUser>("/auth/me");
};

// 修改当前用户密码
export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> => {
  return apiClient.put<{ message: string }>("/auth/me/password", {
    currentPassword,
    newPassword,
  });
};

// 查询当前用户是否有密钥
export const getSecretStatus = async (): Promise<{ hasSecret: boolean }> => {
  return apiClient.get<{ hasSecret: boolean }>("/auth/me/secret");
};

// 生成/重新生成密钥（返回明文密钥，仅此一次可见）
export const generateSecret = async (): Promise<{ secret: string }> => {
  return apiClient.post<{ secret: string }>("/auth/me/secret", {});
};

// 删除/关闭密钥
export const deleteSecret = async (): Promise<{ message: string }> => {
  return apiClient.delete<{ message: string }>("/auth/me/secret");
};

// ============= 管理员接口 =============

// 用户列表项
export interface UserListItem {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

// 获取用户列表
export const getUsers = async (): Promise<{ users: UserListItem[] }> => {
  return apiClient.get<{ users: UserListItem[] }>("/auth/users");
};

// 创建用户参数
export interface CreateUserParams {
  username: string;
  password?: string;
  secret?: string;
  role?: UserRole;
}

// 创建用户
export const createUser = async (
  params: CreateUserParams,
): Promise<{ user: AuthUser }> => {
  return apiClient.post<{ user: AuthUser }>("/auth/users", params);
};

// 删除用户
export const deleteUser = async (userId: number): Promise<{ message: string }> => {
  return apiClient.delete<{ message: string }>(`/auth/users/${userId}`);
};

// 更新用户参数
export interface UpdateUserParams {
  role?: UserRole;
  password?: string;
}

// 更新用户
export const updateUser = async (
  userId: number,
  params: UpdateUserParams,
): Promise<{ user: UserListItem }> => {
  return apiClient.put<{ user: UserListItem }>(`/auth/users/${userId}`, params);
};
