import { Router } from "express";
import { debtService } from "../services/debt.service";
import { validate } from "../middleware/validate";
import { createDebtSchema, payDebtSchema } from "../validation/debt.validation";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status as string,
      clientId: req.query.clientId as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };
    const result = await debtService.getAll(filters, {
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(createDebtSchema), async (req, res, next) => {
  try {
    const debt = await debtService.create(req.body, {
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.status(201).json({ data: debt });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/pay", validate(payDebtSchema), async (req, res, next) => {
  try {
    const result = await debtService.pay(req.params.id, req.body, {
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
