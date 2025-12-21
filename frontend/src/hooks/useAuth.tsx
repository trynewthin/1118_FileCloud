import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { AuthUser } from "@/lib/api/auth";
import { getMe, loginWithPassword, loginWithSecret, register } from "@/lib/api/auth";
import { setAuthToken, getAuthToken } from "@/lib/api/client";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  loginByPassword: (username: string, password: string) => Promise<void>;
  loginBySecret: (secret: string) => Promise<void>;
  registerUser: (username: string, password: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_STORAGE_KEY = "filecloud_auth_token";

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  // 初始化时从 localStorage 还原 token，并尝试获取当前用户
  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored && !getAuthToken()) {
      setAuthToken(stored);
    }

    const bootstrap = async () => {
      try {
        const me = await getMe();
        setState({ user: me, loading: false });
      } catch {
        setAuthToken(null);
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setState({ user: null, loading: false });
      }
    };

    bootstrap();
  }, []);

  const loginByPassword = useCallback(async (username: string, password: string) => {
    const res = await loginWithPassword(username, password);
    setAuthToken(res.token);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setState({ user: res.user, loading: false });
  }, []);

  const loginBySecret = useCallback(async (secret: string) => {
    const res = await loginWithSecret(secret);
    setAuthToken(res.token);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setState({ user: res.user, loading: false });
  }, []);

  const registerUser = useCallback(async (username: string, password: string) => {
    const res = await register(username, password);
    setAuthToken(res.token);
    window.localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setState({ user: res.user, loading: false });
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await getMe();
      setState({ user: me, loading: false });
    } catch {
      setAuthToken(null);
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      setState({ user: null, loading: false });
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setState({ user: null, loading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, loginByPassword, loginBySecret, registerUser, refreshMe, logout }),
    [state, loginByPassword, loginBySecret, registerUser, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }
  return ctx;
};
