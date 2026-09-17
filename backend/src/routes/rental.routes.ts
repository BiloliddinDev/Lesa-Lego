import { Router } from "express";
import { rentalService } from "../services/rental.service";
import { pdfService } from "../services/pdf.service";
import { validate } from "../middleware/validate";
import {
  createRentalSchema,
  returnItemsSchema,
  closeRentalSchema,
  updateRentalSchema,
} from "../validation/rental.validation";
import { authMiddleware, requireAdmin } from "../middleware/auth";

const router = Router();

// Barcha routelar uchun auth talab qilinadi
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status as string,
      clientId: req.query.clientId as string,
      // Worker faqat o'z arendalarini ko'radi, Admin hammasini
      createdBy: req.user.role !== "ADMIN"
        ? req.user._id.toString()
        : (req.query.createdBy as string),
      from: req.query.from as string,
      to: req.query.to as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };
    const result = await rentalService.getAllRentals(filters);
    res.json({
      rentals: result.rentals,
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
    const rental = await rentalService.getRentalById(req.params.id, req.user._id.toString(), req.user.role);
    res.json({ data: rental });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/check", async (req, res, next) => {
  try {
    // Worker faqat o'z arendasining chekini ko'radi (ilgari bu tekshiruv
    // faqat GET /:id da bor edi, chek va PDF ochiq qolgan edi)
    await rentalService.assertRentalAccess(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );
    const check = await rentalService.getRentalCheck(req.params.id);
    res.json({ data: check });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(createRentalSchema), async (req, res, next) => {
  try {
    const rental = await rentalService.createRental(req.body, req.user._id.toString());
    res.status(201).json({ data: rental });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/return", validate(returnItemsSchema), async (req, res, next) => {
  try {
    // Worker faqat o'z arendasidan jihoz qaytara oladi
    await rentalService.assertRentalAccess(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );
    const returnDate = req.body.returnDate ? new Date(req.body.returnDate) : new Date();
    const result = await rentalService.returnItems(req.params.id, req.body.returns, returnDate, req.user._id.toString());
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/close", validate(closeRentalSchema), async (req, res, next) => {
  try {
    // Worker faqat o'z arendasini yopa oladi
    await rentalService.assertRentalAccess(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );
    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();
    const result = await rentalService.closeRental(
      req.params.id,
      endDate,
      req.user._id.toString(),
      req.body.debtDueDate ? new Date(req.body.debtDueDate) : undefined,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, validate(updateRentalSchema), async (req, res, next) => {
  try {
    const rental = await rentalService.updateRental(req.params.id, req.body);
    res.json({ data: rental });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    await rentalService.assertRentalAccess(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );
    const type = (req.query.type as string) || "nakladnoy";
    let pdfBuffer: Buffer;

    if (type === "check") {
      pdfBuffer = await pdfService.generateCheck(req.params.id);
    } else if (type === "contract") {
      pdfBuffer = await pdfService.generateContract(req.params.id);
    } else {
      pdfBuffer = await pdfService.generateNakladnoy(req.params.id);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.id}-${type}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * Hujjatni Telegram orqali yuborish (nakladnoy | check | contract).
 * `toClient=true` bo'lsa mijozga ham ketadi — buning uchun mijozda
 * `telegramId` saqlangan bo'lishi kerak.
 */
router.post("/:id/send-pdf", async (req, res, next) => {
  try {
    await rentalService.assertRentalAccess(
      req.params.id,
      req.user._id.toString(),
      req.user.role,
    );

    const type = (req.body.type as string) || "nakladnoy";
    const toClient = req.body.toClient === true;

    const result = await rentalService.sendRentalDocument(req.params.id, type, toClient);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
