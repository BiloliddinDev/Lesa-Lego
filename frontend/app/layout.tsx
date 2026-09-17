import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lesa Lego",
  description: "Qurilish jihozlarini ijaraga berish boshqaruv tizimi",
};

/**
 * Next 15+ da viewport `metadata` ichida EMAS, alohida eksport bo'lishi kerak —
 * ilgari u `metadata.viewport` da turgan va e'tiborga olinmasdi.
 * `viewport-fit=cover` — telefonlardagi "notch" va pastki chiziq ostidagi
 * xavfsiz zonalar (`env(safe-area-inset-*)`) ishlashi uchun shart.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/*
          Telegram WebApp SDK. Telegram bu skriptni O'ZI QO'SHMAYDI — uni sahifa
          yuklashi kerak. Skriptsiz `window.Telegram` bo'lmaydi, ya'ni:
          initData orqali kirish, `expand()` bilan oynani kengaytirish va mavzu
          moslashuvi — hech biri ishlamaydi (aynan shu sabab Telegram Desktop'da
          ilova oynani to'ldirmay, oq bo'shliqlar bilan ochilardi).
          `beforeInteractive` — React ishga tushishidan oldin yuklansin.
        */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-background font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
