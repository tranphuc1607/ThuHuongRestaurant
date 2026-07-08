"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { getToken, setToken, removeToken } from "@/lib/auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export type UserInfo = {
  id: number;
  username: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role: string;
  status?: string;
};

type AuthContextType = {
  user: UserInfo | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const json = await res.json();
      if (json.statusCode === 200) {
        setUser(json.data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const tryRefreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(8000),
      });
      const json = await res.json();
      if (json.statusCode === 200) {
        return json.data?.accessToken ?? json.data?.access_token ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const init = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const ok = await loadUser(token);
    if (!ok) {
      // Access token hết hạn → thử refresh
      const newToken = await tryRefreshToken();
      if (newToken) {
        setToken(newToken);
        await loadUser(newToken);
      } else {
        removeToken();
        setUser(null);
      }
    }
    setLoading(false);
  }, [loadUser, tryRefreshToken]);

  useEffect(() => {
    init();
  }, [init]);

  async function login(token: string) {
    setToken(token);
    setLoading(true);
    await loadUser(token);
    setLoading(false);
  }

  function logout() {
    removeToken();
    setUser(null);
    // Xóa refresh token cookie phía backend
    fetch(`${BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }

  async function refreshUser() {
    const token = getToken();
    if (!token) return;
    await loadUser(token);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
