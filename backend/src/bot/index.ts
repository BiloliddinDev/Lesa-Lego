import { Bot } from "grammy";
import { env } from "../config/env";
import { setBotInstance } from "../services/notify.service";

export function startBot() {
  if (!env.BOT_TOKEN) {
    console.warn("BOT_TOKEN not set, bot notifications disabled");
    return;
  }

  const bot = new Bot(env.BOT_TOKEN);
  setBotInstance(bot);

  bot.command("start", (ctx) => {
    ctx.reply(
      "Lesa Lego boshqaruv tizimiga xush kelibsiz! 🏗️\n\n" +
      "Bu bot orqali arenda, to'lov va qarzdorlik haqida xabarlar olasiz.\n\n" +
      "Ilovani ochish uchun tugmani bosing 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 Ilovani ochish", web_app: { url: env.WEBAPP_URL } }],
          ],
        },
      },
    );
  });

  bot.command("app", (ctx) => {
    ctx.reply("WebApp ni ochish uchun tugmani bosing:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 Ilovani ochish", web_app: { url: env.WEBAPP_URL } }],
        ],
      },
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
