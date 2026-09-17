import dns from "node:dns";

/**
 * Ba'zi lokal provayderlar Atlas'ning SRV yozuvini qaytarmaydi — shunda
 * DNS'ni ochiq serverga qaratish yordam beradi.
 *
 * LEKIN bu butun process uchun amal qiladi va SERVERDA (Fly.io, Docker)
 * zarar qiladi: platformaning o'z resolveri chetlab o'tiladi, ichki
 * (`.internal`) nomlar ishlamay qoladi va ba'zi tarmoqlarda 53-port
 * yopiq bo'lgani uchun DNS umuman javob bermaydi.
 *
 * Shuning uchun endi FAQAT `USE_PUBLIC_DNS=true` bo'lganda yoqiladi.
 */
if (process.env.USE_PUBLIC_DNS === "true") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  console.log("[DNS] Ommaviy DNS serverlari ishlatilmoqda (8.8.8.8)");
}

import mongoose from "mongoose";
import { env } from "./env.js";

/** Parolni oshkor qilmasdan, faqat host qismini ajratib olish */
function safeHost(uri: string): string {
  return uri.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
}

const READY_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

let lastError: string | null = null;
let connectedAt: string | null = null;

/**
 * BAZA HOLATI — `/health` shu yerdan o'qiydi.
 *
 * Serverga qo'yilganda "ulandimmi yoki yo'qmi" degan savolga javob berishning
 * eng oson yo'li: brauzerda `/health` ni ochish.
 */
export function getDbStatus() {
  const state = mongoose.connection.readyState;
  return {
    state: READY_STATES[state] ?? String(state),
    connected: state === 1,
    host: safeHost(env.MONGODB_URI),
    database: mongoose.connection.name || null,
    connectedAt,
    lastError,
  };
}

mongoose.connection.on("connected", () => {
  connectedAt = new Date().toISOString();
  lastError = null;
  console.log(`[DB] Ulandi ✅ (${safeHost(env.MONGODB_URI)}/${mongoose.connection.name})`);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] Ulanish uzildi ⚠️ — qayta ulanishga urinilmoqda");
});

mongoose.connection.on("reconnected", () => {
  connectedAt = new Date().toISOString();
  console.log("[DB] Qayta ulandi ✅");
});

mongoose.connection.on("error", (err: Error) => {
  lastError = err.message;
  console.error(`[DB] Xato: ${err.message}`);
});

/**
 * Bazaga ulanish.
 *
 * Muvaffaqiyatsiz bo'lsa ham process O'LDIRILMAYDI. Ilgari bu yerda
 * `process.exit(1)` turardi: serverda mashina darhol o'chib, `/health` ni
 * ham ochib bo'lmasdi — ya'ni sababni bilishning iloji yo'q edi, Fly esa
 * faqat "Proxy not finding machines to route requests" deb ko'rsatardi.
 * Endi server ko'tariladi va `/health` aniq sababni aytib beradi.
 */
export const connectDB = async (attempts = 3): Promise<boolean> => {
  const host = safeHost(env.MONGODB_URI);

  for (let i = 1; i <= attempts; i++) {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
      return true;
    } catch (error) {
      lastError = (error as Error).message;
      console.error(`[DB] Ulanmadi (${i}/${attempts}, host: ${host}): ${lastError}`);

      // Eng ko'p uchraydigan uch sabab uchun aniq maslahat
      if (/ENOTFOUND|querySrv|EAI_AGAIN/.test(lastError)) {
        console.error(
          "[DB] DNS xatosi: klaster manzili topilmadi. MONGODB_URI ni tekshiring — " +
            "Atlas klasteri pauza qilingan yoki manzil noto'g'ri bo'lishi mumkin.",
        );
      }
      if (/IP.*not allowed|whitelist|not authorized on admin/i.test(lastError)) {
        console.error(
          "[DB] Atlas IP ruxsati yo'q: Network Access → 0.0.0.0/0 qo'shing " +
            "(server IP manzili o'zgaruvchan).",
        );
      }
      if (/Authentication failed|bad auth/i.test(lastError)) {
        console.error("[DB] Login yoki parol noto'g'ri (MONGODB_URI ichida).");
      }

      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * i));
      }
    }
  }

  console.error(
    "[DB] Ulanib bo'lmadi. Server baribir ko'tariladi — sababni /health da ko'ring.",
  );
  return false;
};
