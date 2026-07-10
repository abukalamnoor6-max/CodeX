"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = {
  contact: string;
  type: "phone" | "email";
  name?: string;
  loggedInAt: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (contact: string, name?: string) => void;
  logout: () => void;
};

const STORAGE_KEY = "codex_auth_user";

const AuthContext = createContext<AuthContextValue | null>(null);

function detectType(contact: string): "phone" | "email" {
  return contact.includes("@") ? "email" : "phone";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const login = useCallback((contact: string, name?: string) => {
    const next: AuthUser = {
      contact: contact.trim(),
      type: detectType(contact.trim()),
      name: name?.trim() || undefined,
      loggedInAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
