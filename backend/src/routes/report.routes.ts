import { Router } from "express";
import { reportService } from "../services/report.service";
import { reconcileAll } from "../services/maintenance.service";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/summary", requireAdmin, async (req, res, next) => {
  try {
    const summary = await reportService.getSummary();
    res.json({ data: summary });
  } catch (error) {
    next(error);
  }
});

router.get("/monthly", requireAdmin, async (req, res, next) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const report = await reportService.getMonthly(year, month);
    res.json({ data: report });
  } catch (error) {
    next(error);
  }
});

router.get("/overdue", async (req, res, next) => {
  try {
    const overdue = await reportService.getOverdue({
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.json({ data: overdue });
  } catch (error) {
    next(error);
  }
});

/** Ombor sanog'i va mijoz qarzlarini qo'lda qayta hisoblash (faqat admin). */
router.post("/reconcile", requireAdmin, async (req, res, next) => {
  try {
    const result = await reconcileAll();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
