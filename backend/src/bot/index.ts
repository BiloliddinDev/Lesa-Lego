import { Bot } from "grammy";
import { env } from "../config/env";
import { User } from "../models/User";
import { setBotInstance } from "../services/notify.service";

/** Ilovani ochish tugmasi */
const openAppKeyboard = {
  inline_keyboard: [[{ text: "🌐 Ilovani ochish", web_app: { url: env.WEBAPP_URL } }]],
};

export function startBot() {
  if (!env.BOT_TOKEN) {
    console.warn("BOT_TOKEN not set, bot notifications disabled");
    return;
  }

  const bot = new Bot(env.BOT_TOKEN);
  setBotInstance(bot);

  /**
   * /start — foydalanuvchini TANIB OLADI.
   *
   * Tizimga kirish faqat oldindan qo'shilgan foydalanuvchilar uchun ochiq
   * (o'z-o'zidan ro'yxatdan o'tish yo'q). Shuning uchun notanish odamga
   * uning Telegram ID sini ko'rsatamiz — u shu ID ni adminga beradi va
   * admin uni "Xodimlar" bo'limidan qo'shadi.
   */
  bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    const user = telegramId ? await User.findOne({ telegramId }) : null;

    if (!user) {
      await ctx.reply(
        "Lesa Lego boshqaruv tizimi 🏗️\n\n" +
          "Siz hali tizimga qo'shilmagansiz.\n" +
          `Sizning Telegram ID: <code>${telegramId}</code>\n\n` +
          "Shu ID ni administratorga yuboring — u sizni xodim sifatida qo'shadi.",
        { parse_mode: "HTML" },
      );
      return;
    }

    if (!user.isActive) {
      await ctx.reply(
        "Hisobingiz bloklangan 🚫\n\nAdministrator bilan bog'laning.",
      );
      return;
    }

    await ctx.reply(
      `Xush kelibsiz, ${user.name}! 🏗️\n\n` +
        `Rol: ${user.role === "ADMIN" ? "Administrator" : "Xodim"}\n` +
        "Bu bot orqali arenda, to'lov va qarzdorlik xabarlarini olasiz.\n\n" +
        "Ilovani ochish uchun tugmani bosing 👇",
      { reply_markup: openAppKeyboard },
    );
  });

  /** O'z Telegram ID sini bilish uchun */
  bot.command("id", async (ctx) => {
    await ctx.reply(`Sizning Telegram ID: <code>${ctx.from?.id}</code>`, {
      parse_mode: "HTML",
    });
  });

  bot.command("app", (ctx) => {
    ctx.reply("WebApp ni ochish uchun tugmani bosing:", {
      reply_markup: openAppKeyboard,
    });
  });

  // Chat menu button — foydalanuvchi bot chatida "Menyu" tugmasidan ilovani ochadi
  if (env.WEBAPP_URL) {
    bot.api
      .setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "Lesa Lego",
          web_app: { url: env.WEBAPP_URL },
        },
      })
      .catch(() => {
        /* menu button sozlanmasa ham davom etamiz */
      });
  }

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  bot.start({
    onStart: (info) => {
      console.log(`Bot started as @${info.username}`);
    },
  }).catch((err) => {
    console.error("Bot start failed (notifications disabled):", err.message);
    setBotInstance(null);
  });
}
