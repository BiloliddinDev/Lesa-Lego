import { Router } from "express";
import { loginWithTelegram, loginDev, devSetup } from "../services/auth.service";
import { authMiddleware } from "../middleware/auth";
import { env } from "../config/env";
import { User } from "../models/User";

const router = Router();

router.post("/telegram", async (req, res, next) => {
  try {
    const { initData } = req.body;

    if (!initData) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "initData kerak" },
      });
    }

    const result = await loginWithTelegram(initData);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;
    res.json({
      data: {
        _id: user._id,
        telegramId: user.telegramId,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Developer mode endpoints (faqat development da) ──
if (env.NODE_ENV === "development") {
  /**
   * Brauzerda test qilish uchun foydalanuvchilar ro'yxati.
   * GET /api/auth/dev-users
   */
  router.get("/dev-users", async (_req, res, next) => {
    try {
      const users = await User.find({ isActive: true })
        .select("_id telegramId name role isActive")
        .sort({ createdAt: -1 });
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Telegram WebApp dan o'tmasdan token olish.
   * POST /api/auth/dev-login
   * Body: { telegramId: number } yoki { userId: string }
   */
  router.post("/dev-login", async (req, res, next) => {
    try {
      const { telegramId, userId } = req.body;

      if (!telegramId && !userId) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "telegramId yoki userId kerak" },
        });
      }

      const result = await loginDev({ telegramId, userId });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * DB bo'sh bo'lganda birinchi admin user yaratish.
   * POST /api/auth/dev-setup
   * Body: { name?: string, telegramId?: number }
   */
  router.post("/dev-setup", async (req, res, next) => {
    try {
      const { name, telegramId } = req.body;
      const result = await devSetup({ name, telegramId });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
