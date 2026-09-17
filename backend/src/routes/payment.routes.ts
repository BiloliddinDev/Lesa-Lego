import { Router } from "express";
import { paymentService } from "../services/payment.service";
import { validate } from "../middleware/validate";
import { createPaymentSchema } from "../validation/payment.validation";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const filters = {
      rentalId: req.query.rentalId as string,
      clientId: req.query.clientId as string,
      method: req.query.method as string,
      from: req.query.from as string,
      to: req.query.to as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };
    const result = await paymentService.getAll(filters, {
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(createPaymentSchema), async (req, res, next) => {
  try {
    const payment = await paymentService.create(req.body, {
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.status(201).json({ data: payment });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await paymentService.delete(req.params.id, req.user._id.toString());
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
