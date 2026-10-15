import { createContext } from "react";
import type { AuthUser } from "@/lib/api/auth";

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  loginByPassword: (username: string, password: string) => Promise<void>;
  loginBySecret: (secret: string) => Promise<void>;
  registerUser: (username: string, password: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

