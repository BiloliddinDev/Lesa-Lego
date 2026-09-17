import { Router } from "express";
import { equipmentService } from "../services/equipment.service";
import { rentalService } from "../services/rental.service";
import { validate } from "../middleware/validate";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  adjustQuantitySchema,
} from "../validation/equipment.validation";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

// Barcha routelar uchun auth talab qilinadi
router.use(authMiddleware);

router.get("/:id/history", async (req, res, next) => {
  try {
    const history = await rentalService.getEquipmentHistory(req.params.id, {
      id: req.user._id.toString(),
      role: req.user.role,
    });
    res.json({ data: history });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filters = {
      categoryId: req.query.categoryId as string,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      available: req.query.available === 'true',
      search: req.query.search as string,
    };
    const equipment = await equipmentService.getAllEquipment(filters);
    res.json({ data: equipment });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const equipment = await equipmentService.getEquipmentById(req.params.id);
    res.json({ data: equipment });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, validate(createEquipmentSchema), async (req, res, next) => {
  try {
    const equipment = await equipmentService.createEquipment(req.body);
    res.status(201).json({ data: equipment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, validate(updateEquipmentSchema), async (req, res, next) => {
  try {
    const equipment = await equipmentService.updateEquipment(req.params.id, req.body);
    res.json({ data: equipment });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/quantity", requireAdmin, validate(adjustQuantitySchema), async (req, res, next) => {
  try {
    const equipment = await equipmentService.adjustQuantity(req.params.id, req.body.adjustment, req.body.reason, req.user._id.toString());
    res.json({ data: equipment });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await equipmentService.deleteEquipment(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
