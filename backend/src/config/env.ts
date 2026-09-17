import { cleanEnv, str, port, url, bool } from 'envalid';
import dotenv from 'dotenv';

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 5000 }),
  MONGODB_URI: str(),
  BOT_TOKEN: str(),
  WEBAPP_URL: url(),
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: '7d' }),
  // Biznes vaqt mintaqasi — kunlik hisob-kitob va hisobot kun chegaralari shunga tayanadi
  APP_TZ: str({ default: 'Asia/Tashkent' }),

  /**
   * Bot (long polling) va cron FAQAT BITTA nusxada ishlashi kerak.
   * Bir necha mashina ko'tarilsa: Telegram 409 "conflict" beradi (bot
   * umuman ishlamaydi), cron esa har kuni bir necha marta ishlab
   * takroriy xabar yuboradi. Shuning uchun ularni o'chirish mumkin.
   */
  ENABLE_BOT: bool({ default: true }),
  ENABLE_CRON: bool({ default: true }),
});
