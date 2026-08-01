import { Router } from "express";
import { categoryService } from "../services/category.service";
import { validate } from "../middleware/validate";
import { createCategorySchema, updateCategorySchema } from "../validation/category.validation";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

// Barcha routelar uchun auth talab qilinadi
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.json({ data: category });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, validate(createCategorySchema), async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, validate(updateCategorySchema), async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.json({ data: category });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
