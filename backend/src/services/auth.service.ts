import { verifyTelegramWebAppData } from "../utils/telegramAuth";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";

interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export async function loginWithTelegram(initData: string) {
  const botToken = process.env.BOT_TOKEN!;

  const isValid = verifyTelegramWebAppData(initData, botToken);
  if (!isValid) {
    throw new AppError("initData noto'g'ri", 401, "AUTH_INVALID_INIT_DATA");
  }

  const params = new URLSearchParams(initData);
  const userStr = params.get("user");

  if (!userStr) {
    throw new AppError("User ma'lumoti yo'q", 401, "AUTH_INVALID_INIT_DATA");
  }

  const tgUser: TelegramUserData = JSON.parse(userStr);

  const user = await User.findOne({ telegramId: tgUser.id });

  if (!user) {
    throw new AppError("Siz tizimga qo'shilmagansiz", 403, "AUTH_USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new AppError("Kirish taqiqlangan", 403, "AUTH_FORBIDDEN");
  }

  // Telegram'dagi ism/username o'zgargan bo'lsa — yangilab qo'yish
  const tgFullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ").trim();
  let changed = false;
  if (tgFullName && user.name !== tgFullName) {
    user.name = tgFullName;
    changed = true;
  }
  if (tgUser.username && user.username !== tgUser.username) {
    user.username = tgUser.username;
    changed = true;
  }
  if (changed) {
    await user.save();
  }

  const token = signToken({
    userId: user._id.toString(),
    telegramId: user.telegramId!,
    role: user.role,
  });

  return {
    token,
    user: {
      _id: user._id,
      telegramId: user.telegramId,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

/**
 * Developer mode login — Telegram WebApp autentifikatsiyasiz.
 * Faqat development muhitida ishlatiladi.
 */
export async function loginDev(options: { telegramId?: number; userId?: string }) {
  let user;

  if (options.userId) {
    user = await User.findById(options.userId);
  } else if (options.telegramId) {
    user = await User.findOne({ telegramId: options.telegramId });
  }

  if (!user) {
    throw new AppError("Foydalanuvchi topilmadi", 404, "AUTH_USER_NOT_FOUND");
  }

  if (!user.isActive) {
    throw new AppError("Kirish taqiqlangan (user nofaol)", 403, "AUTH_FORBIDDEN");
  }

  const token = signToken({
    userId: user._id.toString(),
    telegramId: user.telegramId!,
    role: user.role,
  });

  return {
    token,
    user: {
      _id: user._id,
      telegramId: user.telegramId,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  };
}

/**
 * Developer mode setup — DB bo'sh bo'lganda birinchi admin user yaratish.
 * Faqat development muhitida ishlatiladi.
 */
export async function devSetup(options: { name?: string; telegramId?: number }) {
  const existingCount = await User.countDocuments();
  if (existingCount > 0) {
    throw new AppError("Tizimda allaqachon foydalanuvchilar bor", 400, "USERS_EXIST");
  }

  const user = await User.create({
    telegramId: options.telegramId ?? 1,
    name: options.name || "Admin",
    username: "admin",
    role: "ADMIN",
    isActive: true,
  });

  const token = signToken({
    userId: user._id.toString(),
    telegramId: user.telegramId!,
    role: user.role,
  });

  return {
    token,
    user: {
      _id: user._id,
      telegramId: user.telegramId,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  };
}
