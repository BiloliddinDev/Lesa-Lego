"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { login, telegramLogin, setup, user, isLoading } = useAuth();
  const [telegramId, setTelegramId] = useState("");
  const [name, setName] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isTelegramAuto, setIsTelegramAuto] = useState(false);
  const [telegramFailed, setTelegramFailed] = useState(false);

  React.useEffect(() => {
    if (user && !isLoading) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  // Dev-mode faqat oddiy brauzerda (Telegram WebAppsiz) ishlatiladi.
  // Telegram ichida dev-endpointlar production'da yo'q (404 qaytaradi).
  const isTelegramEnv = typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;

  React.useEffect(() => {
    if (isTelegramEnv) return;
    authApi.devUsers()
      .then((users) => setHasUsers(users.length > 0))
      .catch(() => setHasUsers(false));
  }, [isTelegramEnv]);

  // Telegram WebApp ichida ochilgan bo'lsa, avtomatik kirish
  React.useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) return;

    tg.ready();
    tg.expand();
    setIsTelegramAuto(true);

    telegramLogin(tg.initData)
      .then(() => {
        toast.success("Tizimga kirdingiz");
        router.push("/dashboard");
      })
      .catch((err: any) => {
        setIsTelegramAuto(false);
        setTelegramFailed(true);
        toast.error(err.response?.data?.error?.message || "Telegram orqali kirishda xatolik");
      });
  }, [telegramLogin, router]);

  if (isLoading) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramId) return;
    setIsLoggingIn(true);
    try {
      await login({ telegramId: parseInt(telegramId) });
      toast.success("Tizimga kirdingiz");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Xatolik yuz berdi");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSetup = async () => {
    setIsSettingUp(true);
    try {
      await setup({ name: name || undefined });
      toast.success("Admin user yaratildi");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || "Xatolik yuz berdi");
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <Building2 className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Lesa Lego</h1>
        <p className="text-sm text-muted-foreground">Jihoz ijarasi boshqaruvi</p>
      </div>

      {isTelegramAuto && (
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Telegram orqali kirilmoqda...</p>
          </CardContent>
        </Card>
      )}

      {!isTelegramAuto && telegramFailed && isTelegramEnv && (
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center space-y-2">
            <LogIn className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Kirish imkonsiz</p>
            <p className="text-xs text-muted-foreground">
              Siz tizimga qo&apos;shilmagansiz. Administrator bilan bog&apos;laning.
            </p>
          </CardContent>
        </Card>
      )}

      {!isTelegramAuto && !telegramFailed && hasUsers === true && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Tizimga kirish</CardTitle>
            <CardDescription>Telegram ID orqali kirish</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Telegram ID</label>
                <Input
                  type="number"
                  placeholder="123456789"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                <LogIn className="h-4 w-4" />
                {isLoggingIn ? "Kutilmoqda..." : "Kirish"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!isTelegramAuto && !telegramFailed && hasUsers === false && (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Birinchi admin yaratish</CardTitle>
            <CardDescription>DB bo&apos;sh — iltimos birinchi admin user yarating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ismingiz</label>
              <Input
                placeholder="Admin"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button onClick={handleSetup} className="w-full" disabled={isSettingUp}>
              <UserPlus className="h-4 w-4" />
              {isSettingUp ? "Yaratilmoqda..." : "Admin yaratish"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isTelegramAuto && !telegramFailed && hasUsers === null && (
        <p className="text-sm text-muted-foreground">Ma&apos;lumotlar tekshirilmoqda...</p>
      )}
    </div>
  );
}
