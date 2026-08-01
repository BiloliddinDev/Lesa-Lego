import { Router } from "express";
import { settingsService } from "../services/settings.service";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get("/", async (req, res, next) => {
  try {
    const settings = await settingsService.get();
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

router.patch("/", async (req, res, next) => {
  try {
    const settings = await settingsService.update(req.body, req.user._id.toString());
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

export default router;
