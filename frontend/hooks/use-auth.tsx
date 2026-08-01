"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (data: { telegramId?: number; userId?: string }) => Promise<void>;
  telegramLogin: (initData: string) => Promise<void>;
  setup: (data?: { name?: string; telegramId?: number }) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (data: { telegramId?: number; userId?: string }) => {
    const result = await authApi.devLogin(data);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
  }, []);

  const telegramLogin = useCallback(async (initData: string) => {
    const result = await authApi.telegramLogin(initData);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
  }, []);

  const setup = useCallback(async (data?: { name?: string; telegramId?: number }) => {
    const result = await authApi.devSetup(data);
    localStorage.setItem("token", result.token);
    localStorage.setItem("user", JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "ADMIN";

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, telegramLogin, setup, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
