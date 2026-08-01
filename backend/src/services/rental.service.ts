import { IRental, IRentalItem, IReturnEvent } from "../models/Rental";
import { Rental } from "../models/Rental";
import { Equipment } from "../models/Equipment";
import { Client } from "../models/Client";
import { Payment } from "../models/Payment";
import { Debt } from "../models/Debt";
import { AuditLog } from "../models/AuditLog";
import { notifyService } from "./notify.service";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";

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

    const skip = ((filters.page || 1) - 1) * (filters.limit || 20);
    const limit = filters.limit || 20;

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

  async createRental(data: any, userId: string) {
    const { clientId, items, startDate, expectedEndDate, depositAmount, note, deliveryLocation } = data;

    const client = await Client.findById(clientId);
    if (!client) throw new AppError("Mijoz topilmadi", 404);

    // 1. Check equipment availability and reserve
    for (const item of items) {
      const equipment = await Equipment.findById(item.equipmentId);
      if (!equipment) throw new AppError(`Jihoz topilmadi: ${item.equipmentId}`, 404);
      if ((equipment.totalQuantity - equipment.rentedQuantity) < item.quantity) {
        throw new AppError(`Yetarli jihoz yo'q: ${equipment.name}`, 400);
      }
    }

    // 2. Create rental
    const rental = new Rental({
      client: clientId,
      createdBy: userId,
      items: items.map((item: any) => ({
        equipment: item.equipmentId,
        equipmentName: "", // Will be populated later or handled via snapshot
        equipmentCategory: "", // Will be populated later or handled via snapshot
        quantity: item.quantity,
        dailyRate: item.dailyRate || 0,
        returnedQuantity: 0,
        returns: [],
      })),
      startDate: new Date(startDate),
      expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : undefined,
      depositAmount: depositAmount || 0,
      note,
      deliveryLocation,
    });

    // Populate snapshots before saving (or use a post-save hook)
    for (let i = 0; i < rental.items.length; i++) {
      const eq = await Equipment.findById(rental.items[i].equipment as any);
      if (eq) {
        rental.items[i].equipmentName = eq.name;
        // We'll need category name too, let's get it
        const cat = await eq.populate("category", "name");
        rental.items[i].equipmentCategory = (cat as any).category.name;
      }
    }

    await rental.save();

    // 3. Update equipment quantities
    for (const item of items) {
      await Equipment.findByIdAndUpdate(item.equipmentId, {
        $inc: { rentedQuantity: item.quantity },
      });
    }

    // 4. Audit Log
    await AuditLog.create({
      userId: userId,
      action: "rental.create",
      resourceType: "rental",
      resourceId: rental._id,
      resourceName: rental.rentalNumber,
      after: { client: clientId, items: items.length, startDate },
    });

    // 5. Notification
    notifyService.rentalCreated(rental).catch(console.error);

    return rental;
  }

  async getRentalCheck(rentalId: string) {
    const rental = await Rental.findById(rentalId).populate("client");
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    const today = new Date();
    // Kelajakdagi arenda: hali kun o'tmagan bo'lsa 0 hisoblanadi.
    // Yopilgan arenda: hisob yopilish sanasida to'xtaydi (ortiqcha kun hisoblanmaydi).
    // buildItemDailySchedule dayStart > lastDay bo'lganda bo'sh jadval qaytaradi.
    const checkDate =
      rental.status === "completed" &&
      rental.endDate &&
      rental.endDate < today
        ? rental.endDate
        : today;

    // Har bir jihoz uchun kunlik hisob-kitob
    const itemSchedules = rental.items.map((item) =>
      this.buildItemDailySchedule(item, rental.startDate, checkDate),
    );

    // Umumiy kunlik jadval (barcha jihozlar bo'yicha yig'indisi)
    const maxDays = Math.max(...itemSchedules.map((s) => s.length), 0);
    const dailySchedule: {
      date: string;
      dayNumber: number;
      dailyAmount: number;
      cumulativeAmount: number;
    }[] = [];
    for (let i = 0; i < maxDays; i++) {
      const date = itemSchedules.map((s) => s[i]?.date).find((d) => !!d) || "";
      const dailyAmount = itemSchedules.reduce(
        (sum, s) => sum + (s[i]?.dailyAmount || 0),
        0,
      );
      const prev = i > 0 ? dailySchedule[i - 1].cumulativeAmount : 0;
      dailySchedule.push({
        date,
        dayNumber: i + 1,
        dailyAmount,
        cumulativeAmount: prev + dailyAmount,
      });
    }

    const itemsCalculation = rental.items.map((item, idx) => {
      const schedule = itemSchedules[idx];
      const itemTotal =
        schedule.length > 0
          ? schedule[schedule.length - 1].cumulativeAmount
          : 0;
      const segments = this.calculateSegments(item, rental.startDate, checkDate);

      return {
        equipmentName: item.equipmentName,
        quantity: item.quantity,
        returnedQuantity: item.returnedQuantity,
        activeQuantity: item.quantity - item.returnedQuantity,
        dailyRate: item.dailyRate,
        segments,
        itemTotal,
      };
    });

    const totalAmount =
      dailySchedule.length > 0
        ? dailySchedule[dailySchedule.length - 1].cumulativeAmount
        : 0;
    const debt = totalAmount - rental.depositAmount - rental.paidAmount;

    const clientDoc = rental.client as any;
    return {
      rentalNumber: rental.rentalNumber,
      client: {
        fullName: clientDoc.fullName || clientDoc.name,
        phone: clientDoc.phone,
      },
      startDate: rental.startDate,
      checkDate: checkDate,
      status: rental.status,
      items: itemsCalculation,
      dailySchedule,
      totalAmount,
      depositAmount: rental.depositAmount,
      paidAmount: rental.paidAmount,
      debt,
      overpaid: debt < 0 ? Math.abs(debt) : 0,
    };
  }

  /**
   * Bitta jihoz uchun kunlik hisob-kitob.
   * Har kun uchun: o'sha kungi summa va jami (kumulativ) summa.
   * Masalan: 10 dona × 5 000 so'm/kun → 1-kun 50 000, 2-kun 100 000, ...
   */
  private buildItemDailySchedule(item: IRentalItem, startDate: Date, endDate: Date) {
    const schedule: {
      date: string;
      dayNumber: number;
      dailyAmount: number;
      cumulativeAmount: number;
    }[] = [];

    const dayStart = new Date(startDate);
    dayStart.setHours(0, 0, 0, 0);
    const lastDay = new Date(endDate);
    lastDay.setHours(0, 0, 0, 0);

    // Kelajakdagi arenda: hali kun o'tmagan, jadval bo'sh qoladi
    if (dayStart > lastDay) return schedule;

    const current = new Date(dayStart);
    let dayNumber = 1;
    let cumulative = 0;

    while (current <= lastDay) {
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);

      // Shu kungacha qaytarilganlarini hisobga olib, faol miqdorni aniqlaymiz
      const returnedBefore = item.returns
        .filter((r) => r.date < nextDay)
        .reduce((sum, r) => sum + r.quantity, 0);
      const activeQty = Math.max(item.quantity - returnedBefore, 0);
      const dailyAmount = activeQty * item.dailyRate;

      cumulative += dailyAmount;
      schedule.push({
        date: this.formatLocalDate(current),
        dayNumber,
        dailyAmount,
        cumulativeAmount: cumulative,
      });

      current.setDate(current.getDate() + 1);
      dayNumber++;
    }

    return schedule;
  }

  /**
   * Lokal vaqt bo'yicha YYYY-MM-DD format. `toISOString` dan farqli ravishda
   * vaqt mintaqasi tufayli kunni orqaga surmaydi.
   */
  private formatLocalDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  private calculateSegments(item: IRentalItem, startDate: Date, endDate: Date) {
    let total = 0;
    let prevDate = new Date(startDate);
    let activeQty = item.quantity;
    const segments: any[] = [];

    const sortedReturns = [...item.returns].sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const ret of sortedReturns) {
      if (ret.date <= startDate || ret.date > endDate) continue;

      const days = Math.ceil((ret.date.getTime() - prevDate.getTime()) / 86400000);
      if (days > 0) {
        const amount = activeQty * item.dailyRate * days;
        segments.push({
          from: this.formatDate(prevDate),
          to: this.formatDate(ret.date),
          quantity: activeQty,
          days,
          amount,
        });
        total += amount;
      }

      activeQty -= ret.quantity;
      prevDate = new Date(ret.date);
      if (activeQty <= 0) break;
    }

    if (activeQty > 0 && prevDate < endDate) {
      const days = Math.ceil((endDate.getTime() - prevDate.getTime()) / 86400000);
      if (days > 0) {
        const amount = activeQty * item.dailyRate * days;
        segments.push({
          from: this.formatDate(prevDate),
          to: this.formatDate(endDate),
          quantity: activeQty,
          days,
          amount,
        });
        total += amount;
      }
    }

    return segments;
  }

  private formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  async returnItems(rentalId: string, returns: any[], returnDate: Date, userId: string) {
    const rental = await Rental.findById(rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (rental.status !== "active") throw new AppError("Arenda allaqachon yopilgan", 400);

    for (const ret of returns) {
      const itemIndex = rental.items.findIndex((i) => i.equipment.toString() === ret.equipmentId);
      if (itemIndex === -1) throw new AppError("Jihoz topilmadi", 404);

      const item = rental.items[itemIndex];
      if (ret.quantity > item.quantity - item.returnedQuantity) {
        throw new AppError("Qaytarish miqdori faol miqdordan ko'p", 400);
      }

      item.returns.push({
        date: new Date(returnDate),
        quantity: ret.quantity,
        note: ret.note,
        doneBy: new mongoose.Types.ObjectId(userId),
      });
      item.returnedQuantity += ret.quantity;

      // Update equipment rentedQuantity
      await Equipment.findByIdAndUpdate(item.equipment, {
        $inc: { rentedQuantity: -ret.quantity },
      });
    }

    await rental.save();

    await AuditLog.create({
      userId,
      action: "rental.return_items",
      resourceType: "rental",
      resourceId: rental._id,
      resourceName: rental.rentalNumber,
      after: { returns: returns.map((r: any) => ({ equipmentId: r.equipmentId, quantity: r.quantity })) },
    });

    return {
      rental,
      check: await this.getRentalCheck(rentalId),
    };
  }

  async closeRental(rentalId: string, endDate: Date, userId: string) {
    const rental = await Rental.findById(rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (rental.status !== "active") throw new AppError("Arenda allaqachon yopilgan", 400);

    // Check if all items are returned
    const allReturned = rental.items.every((i) => i.returnedQuantity === i.quantity);
    if (!allReturned) {
      throw new AppError("Hali qaytarilmagan jihozlar bor", 400);
    }

    rental.endDate = endDate;
    rental.status = "completed";
    await rental.save();

    await AuditLog.create({
      userId,
      action: "rental.close",
      resourceType: "rental",
      resourceId: rental._id,
      resourceName: rental.rentalNumber,
      after: { endDate, status: "completed" },
    });

    // Notification
    const finalCheck = await this.getRentalCheck(rentalId);
    notifyService.rentalClosed(rental, finalCheck).catch(console.error);

    // Ensure all equipment rentedQuantity is 0 (safety check)
    for (const item of rental.items) {
        await Equipment.findByIdAndUpdate(item.equipment, {
            $set: { rentedQuantity: 0 }
        });
    }

    return {
      rental,
      finalCheck,
    };
  }

  async getEquipmentHistory(equipmentId: string) {
    const rentals = await Rental.find({
      "items.equipment": new mongoose.Types.ObjectId(equipmentId),
    })
      .populate("client", "fullName phone")
      .populate("createdBy", "name")
      .sort({ startDate: -1 })
      .lean();

    return rentals.map((rental: any) => {
      const equipItem = rental.items.find(
        (i: any) => i.equipment.toString() === equipmentId,
      );
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

  async updateRental(rentalId: string, data: { expectedEndDate?: string; note?: string; deliveryLocation?: { lat: number; lng: number; label?: string } }) {
    const rental = await Rental.findById(rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (rental.status !== "active") throw new AppError("Faqat faol arendani tahrirlash mumkin", 400);

    if (data.expectedEndDate !== undefined) {
      rental.expectedEndDate = new Date(data.expectedEndDate);
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
