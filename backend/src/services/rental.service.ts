import { IRental } from "../models/Rental";
import { Rental } from "../models/Rental";
import { Equipment } from "../models/Equipment";
import { Client } from "../models/Client";
import { AuditLog } from "../models/AuditLog";
import { Debt } from "../models/Debt";
import { notifyService } from "./notify.service";
import { calculateRental } from "./rental-calc";
import { recalculateClientDebt } from "./client-debt.service";
import { Actor, assertRentalOwnership, isAdmin } from "./access.service";
import { endOfTzDay, startOfTzDay } from "../utils/date";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";

/** Yopilmagan arenda holatlari. `overdue` ham faol arenda — u ustida amal qilish mumkin. */
const OPEN_STATUSES = ["active", "overdue"];

export class RentalService {
  async getAllRentals(filters: any) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.client = filters.clientId;
    if (filters.createdBy) query.createdBy = filters.createdBy;
    if (filters.from || filters.to) {
      query.startDate = {};
      if (filters.from) query.startDate.$gte = new Date(filters.from);
      if (filters.to) query.startDate.$lte = new Date(filters.to);
    }

    const limit = filters.limit || 20;
    const skip = ((filters.page || 1) - 1) * limit;

    const [rentals, total] = await Promise.all([
      Rental.find(query)
        .populate("client", "fullName phone")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Rental.countDocuments(query),
    ]);

    return {
      rentals,
      total,
      page: filters.page || 1,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Arendaga ruxsatni tekshiradi: Worker faqat o'zi yaratganini ko'radi,
   * ADMIN — hammasini. Chek va PDF endpointlarida ham shu tekshiruv kerak.
   */
  async assertRentalAccess(rentalId: string, userId: string, role: string) {
    await assertRentalOwnership(rentalId, { id: userId, role });
  }

  async getRentalById(id: string, userId: string, role: string) {
    const rental = await Rental.findById(id)
      .populate("client", "fullName phone")
      .populate("createdBy", "name")
      .populate("items.equipment", "name");

    if (!rental) throw new AppError("Arenda topilmadi", 404);

    if (role !== "ADMIN" && rental.createdBy.toString() !== userId) {
      throw new AppError("Sizga ruxsat berilmagan", 403);
    }

    return rental;
  }

  /**
   * Jihozni ATOMIK band qiladi: mavjudlikni tekshirish va band qilish bitta
   * so'rovda bajariladi. Ilgari tekshiruv va `$inc` orasida bo'shliq bor edi —
   * ikki xodim bir vaqtda arenda ochsa ombordan ortiq band qilinardi.
   * `null` qaytsa — jihoz yo'q, o'chirilgan yoki yetarli emas.
   */
  private async reserveEquipment(equipmentId: string, quantity: number) {
    return Equipment.findOneAndUpdate(
      {
        _id: equipmentId,
        isActive: true,
        $expr: { $gte: [{ $subtract: ["$totalQuantity", "$rentedQuantity"] }, quantity] },
      },
      { $inc: { rentedQuantity: quantity } },
      { new: true },
    );
  }

  /** Band qilingan jihozni bo'shatadi; 0 dan pastga tushmaydi. */
  private async releaseEquipment(equipmentId: mongoose.Types.ObjectId | string, quantity: number) {
    const released = await Equipment.findOneAndUpdate(
      { _id: equipmentId, rentedQuantity: { $gte: quantity } },
      { $inc: { rentedQuantity: -quantity } },
      { new: true },
    );
    if (!released) {
      await Equipment.updateOne(
        { _id: equipmentId, rentedQuantity: { $lt: quantity } },
        { $set: { rentedQuantity: 0 } },
      );
      console.error(
        "[Ombor] " + equipmentId + " uchun " + quantity + " dona bo'shatilmadi — " +
          "rentedQuantity kutilganidan kichik edi, 0 ga tushirildi",
      );
    }
  }

  async createRental(data: any, userId: string) {
    const { clientId, items, startDate, expectedEndDate, depositAmount, note, deliveryLocation } = data;

    const client = await Client.findById(clientId);
    if (!client) throw new AppError("Mijoz topilmadi", 404);

    const start = new Date(startDate);
    if (expectedEndDate && startOfTzDay(expectedEndDate) < startOfTzDay(start)) {
      throw new AppError("Kutilgan qaytarish sanasi boshlanish sanasidan oldin bo'lishi mumkin emas", 400);
    }

    // Bitta jihoz bir necha qatorda yuborilsa miqdorlarni birlashtiramiz,
    // aks holda mavjudlik tekshiruvi har qatorni alohida ko'rib aldanadi.
    const merged = new Map<string, { equipmentId: string; quantity: number; dailyRate?: number }>();
    for (const item of items) {
      const existing = merged.get(item.equipmentId);
      if (existing) {
        existing.quantity += item.quantity;
        if (existing.dailyRate === undefined) existing.dailyRate = item.dailyRate;
      } else {
        merged.set(item.equipmentId, { ...item });
      }
    }
    const normalizedItems = [...merged.values()];

    // 1. Jihozlarni atomik band qilish. Bittasi bo'lmasa — hammasini qaytaramiz.
    const reserved: { equipmentId: string; quantity: number }[] = [];
    const snapshots = new Map<string, { name: string; category: string; dailyRate: number }>();

    try {
      for (const item of normalizedItems) {
        const equipment = await this.reserveEquipment(item.equipmentId, item.quantity);
        if (!equipment) {
          const existing = await Equipment.findById(item.equipmentId).select(
            "name isActive totalQuantity rentedQuantity",
          );
          if (!existing) throw new AppError("Jihoz topilmadi: " + item.equipmentId, 404);
          if (!existing.isActive) throw new AppError("Jihoz o'chirilgan: " + existing.name, 400);
          throw new AppError(
            "Yetarli jihoz yo'q: " + existing.name +
              " (mavjud: " + (existing.totalQuantity - existing.rentedQuantity) + ")",
            400,
          );
        }
        reserved.push({ equipmentId: item.equipmentId, quantity: item.quantity });

        const populated = await equipment.populate("category", "name");
        snapshots.set(item.equipmentId, {
          name: equipment.name,
          category: (populated.category as any)?.name || "",
          // Narx yuborilmasa jihozning joriy narxi olinadi. Ilgari `|| 0` edi —
          // frontend narxni yubormasa arenda butunlay bepul bo'lib qolardi.
          dailyRate: item.dailyRate !== undefined ? item.dailyRate : equipment.dailyRate,
        });
      }

      // 2. Arendani saqlash (raqam to'qnashuvida qayta urinish bilan)
      const rental = await this.saveWithUniqueNumber(
        () =>
          new Rental({
            client: clientId,
            createdBy: userId,
            items: normalizedItems.map((item) => {
              const snap = snapshots.get(item.equipmentId)!;
              return {
                equipment: item.equipmentId,
                equipmentName: snap.name,
                equipmentCategory: snap.category,
                quantity: item.quantity,
                dailyRate: snap.dailyRate,
                returnedQuantity: 0,
                returns: [],
              };
            }),
            startDate: start,
            expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : undefined,
            depositAmount: depositAmount || 0,
            note,
            deliveryLocation,
          }),
      );

      // MUHIM: bu yerdan keyingi amallar arenda ALLAQACHON saqlanganidan
      // so'ng bajariladi. Ular xato bersa rollback qilmaymiz — aks holda
      // jihozlar bo'shatilib, arenda bazada band jihozsiz qolib ketadi.
      // Bu yon amallar (qarz sanog'i, audit, xabar) keyin tuzatilishi mumkin.
      await this.runPostCommit("rental.create", async () => {
        await recalculateClientDebt(clientId);
        await AuditLog.create({
          userId,
          action: "rental.create",
          resourceType: "rental",
          resourceId: rental._id,
          resourceName: rental.rentalNumber,
          after: { client: clientId, items: normalizedItems.length, startDate },
        });
        // Mijoz ma'lumotini yuklab beramiz — aks holda Telegram xabarida
        // "Mijoz: undefined" chiqadi (rental.client bu yerda faqat ObjectId).
        notifyService
          .rentalCreated(await rental.populate("client", "fullName phone"))
          .catch(console.error);
      });

      return rental;
    } catch (error) {
      // Band qilinganlarni qaytarib beramiz, aks holda ombor abadiy band qoladi.
      // Bu yerga faqat arenda saqlanmagan holatda kelamiz (yuqoriga qarang).
      for (const r of reserved) {
        await this.releaseEquipment(r.equipmentId, r.quantity).catch(console.error);
      }
      throw error;
    }
  }

  /**
   * Asosiy o'zgarish bazaga yozilgandan KEYIN bajariladigan yon amallar
   * (mijoz qarzi sanog'i, audit log, Telegram xabari). Bularning xatosi
   * asosiy amalni bekor qilmasligi kerak — ular `POST /api/reports/reconcile`
   * yoki server qayta ishga tushganda qayta hisoblanadi.
   */
  /** `runPostCommit` ning qiymat qaytaradigan varianti: xato bo'lsa `null`. */
  private async runPostCommitValue<T>(action: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      console.error(`[PostCommit] ${action} bajarilmadi:`, err);
      return null;
    }
  }

  private async runPostCommit(action: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      console.error(`[PostCommit] ${action} yon amallari bajarilmadi:`, err);
    }
  }

  /**
   * `rentalNumber` unique indeksiga tushib qolsa raqamni qayta generatsiya
   * qilib urinadi — parallel yaratishda to'qnashuv bo'lishi mumkin.
   */
  private async saveWithUniqueNumber(build: () => IRental, attempts = 5): Promise<IRental> {
    for (let i = 0; i < attempts; i++) {
      const doc = build();
      try {
        await doc.save();
        return doc;
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
    }
    throw new AppError("Arenda raqamini yaratib bo'lmadi, qayta urinib ko'ring", 409);
  }

  /** Chek — barcha summalar `rental-calc` dan. PDF ham aynan shu manbadan oladi. */
  async getRentalCheck(rentalId: string) {
    const rental = await Rental.findById(rentalId).populate("client", "fullName phone");
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    const calc = calculateRental(rental);
    const clientDoc = rental.client as any;

    return {
      rentalNumber: rental.rentalNumber,
      client: {
        fullName: clientDoc.fullName,
        phone: clientDoc.phone,
      },
      startDate: rental.startDate,
      checkDate: calc.checkDate,
      days: calc.days,
      status: rental.status,
      items: calc.items,
      dailySchedule: calc.dailySchedule,
      totalAmount: calc.totalAmount,
      depositAmount: calc.depositAmount,
      paidAmount: calc.paidAmount,
      debt: calc.debt,
      overpaid: calc.overpaid,
    };
  }

  async returnItems(rentalId: string, returns: any[], returnDate: Date, userId: string) {
    const rental = await Rental.findById(rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (!OPEN_STATUSES.includes(rental.status)) {
      throw new AppError("Arenda allaqachon yopilgan", 400);
    }

    // Sana tekshiruvi: ilgari yo'q edi va arenda boshlanishidan oldingi sana
    // bilan qaytarilgan jihoz hisob-kitobdan butunlay tushib qolardi.
    const date = new Date(returnDate);
    if (isNaN(date.getTime())) throw new AppError("Qaytarish sanasi yaroqsiz", 400);
    if (startOfTzDay(date) < startOfTzDay(rental.startDate)) {
      throw new AppError("Qaytarish sanasi arenda boshlanish sanasidan oldin bo'lishi mumkin emas", 400);
    }
    if (date > endOfTzDay(new Date())) {
      throw new AppError("Qaytarish sanasi kelajakda bo'lishi mumkin emas", 400);
    }

    // Bir so'rovda bitta jihoz bir necha qatorda kelsa — yig'ib tekshiramiz
    const perEquipment = new Map<string, number>();
    for (const ret of returns) {
      perEquipment.set(ret.equipmentId, (perEquipment.get(ret.equipmentId) || 0) + ret.quantity);
    }
    for (const [equipmentId, quantity] of perEquipment) {
      const item = rental.items.find((i) => i.equipment.toString() === equipmentId);
      if (!item) throw new AppError("Jihoz bu arendada yo'q", 404);
      const active = item.quantity - item.returnedQuantity;
      if (quantity > active) {
        throw new AppError(
          "Qaytarish miqdori faol miqdordan ko'p: " + item.equipmentName + " (faol: " + active + ")",
          400,
        );
      }
    }

    for (const ret of returns) {
      const item = rental.items.find((i) => i.equipment.toString() === ret.equipmentId)!;
      item.returns.push({
        date,
        quantity: ret.quantity,
        note: ret.note,
        doneBy: new mongoose.Types.ObjectId(userId),
      });
      item.returnedQuantity += ret.quantity;
    }

    // Avval arendani saqlaymiz, keyin ombordan bo'shatamiz. Bo'shatish uzilsa
    // ombor ORTIQCHA band qolib, ortiqcha berishni bloklaydi — teskari
    // tartibda esa aksincha, yo'q jihoz arendaga berilib ketishi mumkin edi.
    await rental.save();

    for (const [equipmentId, quantity] of perEquipment) {
      await this.releaseEquipment(equipmentId, quantity).catch(console.error);
    }

    await this.runPostCommit("rental.return_items", async () => {
      await recalculateClientDebt(rental.client.toString());
      await AuditLog.create({
        userId,
        action: "rental.return_items",
        resourceType: "rental",
        resourceId: rental._id,
        resourceName: rental.rentalNumber,
        after: {
          returnDate: date,
          returns: returns.map((r: any) => ({ equipmentId: r.equipmentId, quantity: r.quantity })),
        },
      });
    });

    return {
      rental,
      check: await this.getRentalCheck(rentalId),
    };
  }

  async closeRental(rentalId: string, endDate: Date, userId: string, debtDueDate?: Date) {
    const rental = await Rental.findById(rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (!OPEN_STATUSES.includes(rental.status)) {
      throw new AppError("Arenda allaqachon yopilgan", 400);
    }

    const allReturned = rental.items.every((i) => i.returnedQuantity === i.quantity);
    if (!allReturned) {
      throw new AppError("Hali qaytarilmagan jihozlar bor", 400);
    }

    const end = new Date(endDate);
    if (isNaN(end.getTime())) throw new AppError("Yopilish sanasi yaroqsiz", 400);
    if (startOfTzDay(end) < startOfTzDay(rental.startDate)) {
      throw new AppError("Yopilish sanasi boshlanish sanasidan oldin bo'lishi mumkin emas", 400);
    }
    if (end > endOfTzDay(new Date())) {
      throw new AppError("Yopilish sanasi kelajakda bo'lishi mumkin emas", 400);
    }

    rental.endDate = end;
    rental.status = "completed";
    await rental.save();

    // DIQQAT: jihozlarning `rentedQuantity` si bu yerda O'ZGARTIRILMAYDI.
    // Har bir qaytarish `returnItems` da allaqachon atomik bo'shatilgan.
    // Ilgari bu yerda `$set: { rentedQuantity: 0 }` turardi — u jihozning
    // GLOBAL band sanog'ini nolga tushirib, boshqa faol arendalarda turgan
    // miqdorlarni ham yo'q qilardi.

    await this.runPostCommit("rental.close", async () => {
      await recalculateClientDebt(rental.client.toString());
      await AuditLog.create({
        userId,
        action: "rental.close",
        resourceType: "rental",
        resourceId: rental._id,
        resourceName: rental.rentalNumber,
        after: { endDate: end, status: "completed" },
      });
    });

    const finalCheck = await this.getRentalCheck(rentalId);

    // Qarz qolgan bo'lsa — nasiya hujjati AVTOMATIK ochiladi (docs/debits.md).
    // Ilgari buni qo'lda `POST /debts` bilan qilish kerak edi, ya'ni amalda
    // hech qachon ochilmasdi: qarz faqat `Client.totalDebt` raqamida qolib,
    // muddat ham, eslatma ham bo'lmasdi.
    let debt = null;
    if (finalCheck.debt > 0) {
      debt = await this.runPostCommitValue("rental.close.debt", () =>
        Debt.create({
          client: rental.client,
          rental: rental._id,
          amount: finalCheck.debt,
          dueDate: debtDueDate,
          status: "pending",
          note: "Arenda yopilganda qolgan qarz: " + rental.rentalNumber,
        }),
      );
    }

    notifyService.rentalClosed(rental, finalCheck).catch(console.error);

    return { rental, finalCheck, debt };
  }

  /**
   * Jihozning harakatlar tarixi. Worker bu yerda ham faqat o'zi ochgan
   * arendalarni ko'radi — aks holda jihoz kartasi orqali begona arendalar
   * va mijozlar ro'yxati ochilib qolardi.
   */
  async getEquipmentHistory(equipmentId: string, actor: Actor) {
    const query: Record<string, unknown> = {
      "items.equipment": new mongoose.Types.ObjectId(equipmentId),
    };
    if (!isAdmin(actor.role)) query.createdBy = actor.id;

    const rentals = await Rental.find(query)
      .populate("client", "fullName phone")
      .populate("createdBy", "name")
      .sort({ startDate: -1 })
      .lean();

    return rentals.map((rental: any) => {
      const equipItem = rental.items.find((i: any) => i.equipment.toString() === equipmentId);
      return {
        _id: rental._id,
        rentalNumber: rental.rentalNumber,
        client: rental.client,
        createdBy: rental.createdBy,
        startDate: rental.startDate,
        endDate: rental.endDate,
        status: rental.status,
        quantity: equipItem?.quantity || 0,
        returnedQuantity: equipItem?.returnedQuantity || 0,
        activeQuantity: (equipItem?.quantity || 0) - (equipItem?.returnedQuantity || 0),
        dailyRate: equipItem?.dailyRate || 0,
      };
    });
  }

  async updateRental(
    rentalId: string,
    data: {
      expectedEndDate?: string;
      note?: string;
      deliveryLocation?: { lat: number; lng: number; label?: string };
    },
  ) {
    const rental = await Rental.findById(rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (!OPEN_STATUSES.includes(rental.status)) {
      throw new AppError("Faqat yopilmagan arendani tahrirlash mumkin", 400);
    }

    if (data.expectedEndDate !== undefined) {
      const expected = new Date(data.expectedEndDate);
      if (isNaN(expected.getTime())) throw new AppError("Sana yaroqsiz", 400);
      if (startOfTzDay(expected) < startOfTzDay(rental.startDate)) {
        throw new AppError("Kutilgan qaytarish sanasi boshlanish sanasidan oldin bo'lishi mumkin emas", 400);
      }
      rental.expectedEndDate = expected;
      // Muddat oldinga surilsa arenda "muddati o'tgan" holatidan chiqadi
      if (rental.status === "overdue" && startOfTzDay(expected) >= startOfTzDay(new Date())) {
        rental.status = "active";
      }
    }
    if (data.note !== undefined) {
      rental.note = data.note;
    }
    if (data.deliveryLocation !== undefined) {
      rental.deliveryLocation = data.deliveryLocation;
    }

    await rental.save();
    return rental;
  }
}

export const rentalService = new RentalService();
