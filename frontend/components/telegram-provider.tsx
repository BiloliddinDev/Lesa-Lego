"use client";

import React from "react";

/**
 * TELEGRAM WEBAPP INTEGRATSIYASI — bitta joyda, ilovaning eng tepasida.
 *
 * Ilgari `ready()` va `expand()` faqat LOGIN sahifasida chaqirilardi. Token
 * saqlangan foydalanuvchi to'g'ridan-to'g'ri `/dashboard` ga tushardi va bu
 * chaqiruvlar UMUMAN bajarilmasdi — Telegram oynani kengaytirmasdi va
 * ilova balandligini bilmasdi. Endi u har qanday sahifada ishlaydi.
 *
 * Bu yerda uch narsa qilinadi:
 *  1. `ready()` + `expand()` — Telegramga "yuklandim, oynani ochib ber" signali
 *  2. Viewport balandligi `--tg-viewport-stable-height` CSS o'zgaruvchisiga
 *     yoziladi: Desktop'da ham, mobilda klaviatura ochilganda ham haqiqiy
 *     balandlik `100dvh` dan farq qiladi
 *  3. Telegram mavzusi (light/dark) ilova mavzusiga moslanadi — aks holda
 *     qorong'i Telegram ichida oq ilova "oq bo'shliq" bo'lib ko'rinadi
 */

/** `rgb(10, 10, 10)` → `#0a0a0a` (Telegram faqat HEX qabul qiladi) */
function rgbToHex(color: string): string | null {
  const match = color.match(/\d+(\.\d+)?/g);
  if (!match || match.length < 3) return null;
  const [r, g, b] = match.slice(0, 3).map((n) => Math.round(Number(n)));
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    tg.ready();
    tg.expand?.();
    // Pastga tortganda ilova yopilib ketmasligi uchun (Bot API 7.7+)
    tg.disableVerticalSwipes?.();

    const applyViewport = () => {
      const height = tg.viewportStableHeight || tg.viewportHeight;
      if (height) {
        document.documentElement.style.setProperty(
          "--tg-viewport-stable-height",
          `${height}px`,
        );
      }
    };

    const applyTheme = () => {
      const isDark = tg.colorScheme === "dark";
      document.documentElement.classList.toggle("dark", isDark);

      // Mavzu almashgach body rangi yangilanishi uchun keyingi kadrda o'qiymiz
      requestAnimationFrame(() => {
        const bg = rgbToHex(getComputedStyle(document.body).backgroundColor);
        if (!bg) return;
        try {
          tg.setBackgroundColor?.(bg);
          tg.setHeaderColor?.(bg);
        } catch {
          /* eski klientlar HEX ni qo'llamaydi — e'tiborsiz qoldiramiz */
        }
      });
    };

    applyViewport();
    applyTheme();

    tg.onEvent?.("viewportChanged", applyViewport);
    tg.onEvent?.("themeChanged", applyTheme);

    return () => {
      tg.offEvent?.("viewportChanged", applyViewport);
      tg.offEvent?.("themeChanged", applyTheme);
    };
  }, []);

  return <>{children}</>;
}
