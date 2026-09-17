import type { NextConfig } from "next";

/**
 * Backend manzili. Telegram WebApp faqat HTTPS ochiq manzilda ishlaydi,
 * shuning uchun frontend tunnel (ngrok/cloudflared) orqali ochiladi.
 * Telefondagi Telegram uchun `localhost:5000` mavjud emas — shuning uchun
 * `/api/*` so'rovlari shu yerda backendga PROXY qilinadi va bitta tunnel
 * yetarli bo'ladi (bonus: CORS muammosi ham chiqmaydi, origin bitta).
 */
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  // Tunnel (ngrok/cloudflared) orqali kelgan dev so'rovlariga ruxsat.
  // Next 15.3+ boshqa origin'dan kelgan dev so'rovlarni bloklaydi va
  // Telegram ichida ilova "ishlamayapti" bo'lib ko'rinadi.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io", "*.loca.lt"],

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
