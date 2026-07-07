import { Router } from "express";
import { UserService } from "../services/user.service";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  updateSelfSchema,
  getUsersQuerySchema,
  auditFilterSchema,
} from "../validation/user.validation";

const router = Router();

// Har bir route uchun login talab qilinadi
router.use(authMiddleware);

// ── Self-service: har qanday login qilgan user (admin yoki worker) ──
// MUHIM: bu /:id dan OLDIN va requireAdmin dan OLDIN turishi shart
router.patch("/me", validateBody(updateSelfSchema), async (req, res, next) => {
  try {
    const user = await UserService.updateSelf(
      req.user._id.toString(),
      req.body,
    );
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    res.json({ data: req.user });
  } catch (err) {
    next(err);
  }
});

// ── Shu joydan pastda faqat Admin uchun ──
router.use(requireAdmin);

router.get("/", validateQuery(getUsersQuerySchema), async (req, res, next) => {
  try {
    const users = await UserService.getAll(req.query as any);
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

router.post("/", validateBody(createUserSchema), async (req, res, next) => {
  try {
    const user = await UserService.create(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await UserService.getById(req.params.id);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", validateBody(updateUserSchema), async (req, res, next) => {
  try {
    const user = await UserService.update(req.params.id, req.body);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:id/audit",
  validateQuery(auditFilterSchema),
  async (req, res, next) => {
    try {
      const result = await UserService.getAudit(
        req.params.id,
        req.query as any,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
