import dns from "node:dns";
// Ba'zi provayderlar Atlas'ning SRV yozuvini qaytarmaydi — DNS'ni ochiq serverga qaratamiz.
// DIQQAT: bu butun process uchun amal qiladi. Agar MONGODB_URI lokal yoki ichki
// (VPN) hostga qaratilsa, bu qatorni o'chirish kerak bo'lishi mumkin.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

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
