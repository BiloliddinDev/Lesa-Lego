import { Router } from "express";
import { clientService } from "../services/client.service";
import { validate } from "../middleware/validate";
import {
  createClientSchema,
  updateClientSchema,
} from "../validation/client.validation";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

// Barcha routelar uchun auth talab qilinadi
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search as string,
      hasDebt: req.query.hasDebt === 'true',
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };
    const result = await clientService.getAllClients(filters);
    res.json({
      data: result.clients,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(createClientSchema), async (req, res, next) => {
  try {
    const client = await clientService.createClient({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json({ data: client });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, validate(updateClientSchema), async (req, res, next) => {
  try {
    const client = await clientService.updateClient(req.params.id, req.body);
    res.json({ data: client });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await clientService.deleteClient(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
