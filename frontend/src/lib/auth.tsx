"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UNAUTHORIZED_EVENT, apiFetch } from "./api";
import type { Role, User } from "./types";

const TOKEN_KEY = "uls_token";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

function readToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeToken(token: string | null): void {
  if (token) {
    // 1 ngày, đúng hạn của JWT
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=86400; samesite=lax`;
  } else {
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = readToken();
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    apiFetch<User>("/auth/me", { token: saved })
      .then(setUser)
      .catch(() => {
        writeToken(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // 401 giữa phiên (token hết hạn, tài khoản bị khoá): đăng xuất và về trang đăng nhập, nhớ trang đang xem
  useEffect(() => {
    const onUnauthorized = () => {
      if (!readToken()) return;
      writeToken(null);
      setToken(null);
      setUser(null);
      const here = window.location.pathname + window.location.search;
      // Trang công khai (tra cứu sách…) thì ở lại, chỉ trang cần đăng nhập mới chuyển hướng
      const needsLogin = /^\/(admin|my|librarian|reports|recommendations)(\/|$)/.test(window.location.pathname);
      if (needsLogin) window.location.assign(`/login?next=${encodeURIComponent(here)}`);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    writeToken(result.accessToken);
    setToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      if (roles.includes(user.role)) return true;
      // Admin làm được mọi việc của thủ thư
      return user.role === "ADMIN" && roles.includes("LIBRARIAN");
    },
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, login, logout, can }),
    [user, token, loading, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải nằm trong AuthProvider");
  return context;
}
