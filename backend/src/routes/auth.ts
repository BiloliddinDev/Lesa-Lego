import { Router } from "express";
import { loginWithTelegram } from "../services/auth.service";

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

export default router;
