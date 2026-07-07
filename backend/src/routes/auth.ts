import { Router } from "express";
import { loginWithTelegram } from "../services/auth.service";
import { authMiddleware } from "../middleware/auth";

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
        fullName: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: (user as any).createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
