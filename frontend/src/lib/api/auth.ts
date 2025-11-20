import { apiClient, setAuthToken } from "./client";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: number;
  username: string | null;
  role: UserRole;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const login = async (secret: string): Promise<LoginResponse> => {
  const data = await apiClient.post<LoginResponse>("/auth/login", { secret });
  setAuthToken(data.token);
  return data;
};

export const initAdmin = async (secret: string): Promise<LoginResponse> => {
  const data = await apiClient.post<LoginResponse>("/auth/init-admin", { secret });
  setAuthToken(data.token);
  return data;
};

export const getMe = async (): Promise<AuthUser> => {
  return apiClient.get<AuthUser>("/auth/me");
};

export interface CreateUserKeyResponse {
  secret: string;
  user: AuthUser;
}

export const createUserKey = async (
  role: "user",
  username?: string,
): Promise<CreateUserKeyResponse> => {
  return apiClient.post<CreateUserKeyResponse>("/auth/keys", {
    role,
    username,
  });
};
