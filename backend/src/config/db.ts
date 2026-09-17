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

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host} ✅✅✅`);
  } catch (error) {
    const message = (error as Error).message;
    // URI dagi parolni logga chiqarmaymiz — faqat host qismini ko'rsatamiz
    const host = env.MONGODB_URI.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, "").split("/")[0];
    console.error(`MongoDB ulanmadi (host: ${host}): ${message}`);
    if (/ENOTFOUND|querySrv|EAI_AGAIN/.test(message)) {
      console.error(
        "Bu DNS xatosi: klaster manzili topilmadi. MONGODB_URI ni tekshiring — " +
          "Atlas klasteri o'chirilgan/pauza qilingan yoki manzil noto'g'ri yozilgan bo'lishi mumkin."
      );
    }
    process.exit(1);
  }
};
