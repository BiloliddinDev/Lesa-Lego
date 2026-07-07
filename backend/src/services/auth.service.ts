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
    throw new AppError("AUTH_INVALID_INIT_DATA", "initData noto'g'ri", 401);
  }

  const params = new URLSearchParams(initData);
  const userStr = params.get("user");

  if (!userStr) {
    throw new AppError("AUTH_INVALID_INIT_DATA", "User ma'lumoti yo'q", 401);
  }

  const tgUser: TelegramUserData = JSON.parse(userStr);

  const user = await User.findOne({ telegramId: tgUser.id });

  if (!user) {
    throw new AppError(
      "AUTH_USER_NOT_FOUND",
      "Siz tizimga qo'shilmagansiz",
      403,
    );
  }

  if (!user.isActive) {
    throw new AppError("AUTH_FORBIDDEN", "Kirish taqiqlangan", 403);
  }

  const token = signToken({
    userId: user._id.toString(),
    telegramId: user.telegramId,
    role: user.role,
  });

  return {
    token,
    user: {
      _id: user._id,
      telegramId: user.telegramId,
      fullName: user.name,
      role: user.role,
      isActive: user.isActive,
    },
  };
}
