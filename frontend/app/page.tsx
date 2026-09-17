"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { API_BASE, authApi, describeApiError, type ApiFailure } from "@/lib/api";
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
  // Telegram bergan ID — xato ekranida ko'rsatiladi (bazadagisi bilan solishtirish uchun)
  const tgUserId =
    typeof window !== "undefined"
      ? window.Telegram?.WebApp?.initDataUnsafe?.user?.id
      : undefined;
  const [telegramFailed, setTelegramFailed] = useState(false);
  // Backend bilan bog'liq xato — "DB bo'sh" degan noto'g'ri xulosa o'rniga
  // haqiqiy sababni ko'rsatish uchun
  const [apiError, setApiError] = useState<ApiFailure | null>(null);

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
    authApi
      .devUsers()
      .then((users) => {
        setApiError(null);
        setHasUsers(users.length > 0);
      })
      .catch((err) => {
        // ILGARI bu yerda shunchaki `setHasUsers(false)` turardi va natijada
        // backend javob bermayotgan bo'lsa ham ekranda "DB bo'sh — birinchi
        // admin yarating" chiqardi. Bazada admin bor bo'lsa ham.
        const failure = describeApiError(err);
        setApiError(failure);
        setHasUsers(null);
      });
  }, [isTelegramEnv]);

  // Telegram WebApp ichida ochilgan bo'lsa, avtomatik kirish
  React.useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) return;

    // `ready()` / `expand()` bu yerda EMAS — ular `TelegramProvider` da,
    // ilovaning eng tepasida chaqiriladi (token saqlangan foydalanuvchi bu
    // sahifani umuman ochmasligi mumkin).
    setIsTelegramAuto(true);

    telegramLogin(tg.initData)
      .then(() => {
        toast.success("Tizimga kirdingiz");
        router.push("/dashboard");
      })
      .catch((err: any) => {
        setIsTelegramAuto(false);
        setTelegramFailed(true);
        const failure = describeApiError(err);
        setApiError(failure);
        toast.error(failure.message);
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
      // Telegram ID NI UZATISH SHART: aks holda admin `telegramId: 1` bilan
      // yaratiladi va keyin Telegram WebApp orqali hech qachon kira olmaydi
      // (initData dagi haqiqiy ID bazadagisi bilan mos kelmaydi).
      await setup({
        name: name || undefined,
        telegramId: telegramId ? parseInt(telegramId) : undefined,
      });
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

      {/*
        Telegram orqali kirish muvaffaqiyatsiz. MUHIM: sabab ikki xil bo'lishi
        mumkin va ularni aralashtirib yubormaslik kerak —
        403 = haqiqatan tizimga qo'shilmagansiz;
        404/tarmoq = backendga umuman yetib borilmadi (bazada admin bo'lsa ham).
      */}
      {!isTelegramAuto && telegramFailed && isTelegramEnv && (
        <Card className="w-full max-w-sm">
          <CardContent className="p-6 text-center space-y-2">
            <LogIn className="h-8 w-8 mx-auto text-muted-foreground" />
            {apiError?.kind === "forbidden" ? (
              <>
                <p className="text-sm font-medium">Kirish imkonsiz</p>
                <p className="text-xs text-muted-foreground">{apiError.message}</p>
                <p className="text-xs text-muted-foreground">
                  Sizning Telegram ID:{" "}
                  <b>{tgUserId ?? "—"}</b> — administrator shu ID ni qo&apos;shishi kerak.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Server bilan bog&apos;lanib bo&apos;lmadi</p>
                <p className="text-xs text-destructive">
                  {apiError?.message}
                  {apiError?.status ? ` (${apiError.status})` : ""}
                </p>
                {apiError?.hint && (
                  <p className="text-xs text-muted-foreground">{apiError.hint}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Brauzerda backendga yetib borilmagan holat */}
      {!isTelegramEnv && apiError && (
        <Card className="w-full max-w-sm border-destructive/40">
          <CardHeader>
            <CardTitle className="text-lg">Server bilan bog&apos;lanib bo&apos;lmadi</CardTitle>
            <CardDescription>
              Shuning uchun bazada foydalanuvchi bor-yo&apos;qligini aniqlab bo&apos;lmadi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-destructive">
              {apiError.message}
              {apiError.status ? ` (${apiError.status})` : ""}
            </p>
            {apiError.hint && (
              <p className="text-xs text-muted-foreground">{apiError.hint}</p>
            )}
            <p className="text-xs text-muted-foreground">
              API manzili: <code>{API_BASE}</code>
            </p>
            {apiError.kind === "not_found" && (
              <p className="text-xs text-muted-foreground">
                Eslatma: <code>/auth/dev-users</code> faqat{" "}
                <code>NODE_ENV=development</code> da mavjud. Production backendda
                u 404 qaytaradi — bu normal, kirish Telegram orqali amalga oshiriladi.
              </p>
            )}
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Telegram ID</label>
              <Input
                type="number"
                placeholder="123456789"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Botga <b>/id</b> deb yozsangiz ID ingizni aytadi. Telegram orqali
                kirish aynan shu ID bo'yicha ishlaydi — keyin o'zgartirib bo'lmaydi.
              </p>
            </div>
            <Button
              onClick={handleSetup}
              className="w-full"
              disabled={isSettingUp || !telegramId}
            >
              <UserPlus className="h-4 w-4" />
              {isSettingUp ? "Yaratilmoqda..." : "Admin yaratish"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isTelegramAuto && !telegramFailed && hasUsers === null && !apiError && (
        <p className="text-sm text-muted-foreground">Ma&apos;lumotlar tekshirilmoqda...</p>
      )}
    </div>
  );
}
