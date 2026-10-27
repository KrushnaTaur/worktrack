import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { tokenStorage } from "../api/client";
import { authApi } from "../api/services";
import type { User } from "../types";

interface AuthValue {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // If a refresh token exists we must check it before deciding whether to show /login.
  const [loading, setLoading] = useState<boolean>(() => Boolean(tokenStorage.refresh));

  useEffect(() => {
    let active = true;
    if (tokenStorage.refresh) {
      authApi
        .me()
        .then((me) => { if (active) setUser(me); })
        .catch(() => tokenStorage.clear())
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, []);

  // The Axios interceptor fires this when a refresh fails.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    tokenStorage.set(data.access, data.refresh);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.refresh;
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // The token may already be invalid; we still clear the local session.
    }
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, isAdmin: user?.role === "ADMIN", loading, login, logout }),
    [user, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}