import { Rental } from "../models/Rental";
import { Payment } from "../models/Payment";
import { Client } from "../models/Client";
import { Equipment } from "../models/Equipment";
import { calculateRental } from "./rental-calc";
import { Actor, isAdmin } from "./access.service";
import {
  APP_TZ,
  addTzDays,
  endOfTzDay,
  inclusiveTzDayCount,
  startOfTzDay,
  tzDateKey,
  tzMonthRange,
} from "../utils/date";

/** Yopilmagan arendalar — muddati o'tganlari ham shu ro'yxatda. */
const OPEN_STATUSES = ["active", "overdue"];

export class ReportService {
  async getSummary() {
    const today = startOfTzDay(new Date());
    const todayEnd = endOfTzDay(new Date());
    const range = { $gte: today, $lte: todayEnd };

    const [
      activeRentals,
      overdueRentals,
      totalDebtors,
      totalDebt,
      equipmentStats,
      newRentals,
      closedRentals,
      paymentsToday,
      depositsToday,
      newClients,
    ] = await Promise.all([
      Rental.countDocuments({ status: "active" }),
      Rental.countDocuments({ status: "overdue" }),
      Client.countDocuments({ totalDebt: { $gt: 0 } }),
      Client.aggregate([
        { $match: { totalDebt: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$totalDebt" } } },
      ]),
      Equipment.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalOut: { $sum: "$rentedQuantity" },
            totalAvailable: { $sum: { $subtract: ["$totalQuantity", "$rentedQuantity"] } },
          },
        },
      ]),
      Rental.countDocuments({ createdAt: range }),
      Rental.countDocuments({ endDate: range }),
      Payment.aggregate([
        { $match: { createdAt: range } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Rental.aggregate([
        { $match: { createdAt: range } },
        { $group: { _id: null, total: { $sum: "$depositAmount" } } },
      ]),
      Client.countDocuments({ createdAt: range }),
    ]);

    const payments = paymentsToday[0]?.total || 0;
    const deposits = depositsToday[0]?.total || 0;

    return {
      // Sana biznes mintaqasi bo'yicha — `toISOString()` UTC'ga siljitib,
      // UTC+5 da kunni bir kun orqaga surib yuborardi.
      today: tzDateKey(today),
      timezone: APP_TZ,
      activeRentals,
      overdueRentals,
      totalDebtors,
      totalDebt: totalDebt[0]?.total || 0,
      equipmentStats: {
        totalOut: equipmentStats[0]?.totalOut || 0,
        totalAvailable: equipmentStats[0]?.totalAvailable || 0,
      },
      todayStats: {
        newRentals,
        closedRentals,
        paymentsReceived: payments,
        depositsReceived: deposits,
        // Kassaga bugun tushgan pul: to'lovlar + yangi arendalar omonati
        cashReceived: payments + deposits,
        newClients,
      },
    };
  }

  async getMonthly(year: number, month: number) {
    const { start: startDate, end: endDate } = tzMonthRange(year, month);
    const range = { $gte: startDate, $lte: endDate };

    const [
      newRentals,
      closedRentals,
      newClients,
      paymentsData,
      depositsData,
      topClients,
      topEquipment,
      dailyRevenue,
    ] = await Promise.all([
      Rental.countDocuments({ createdAt: range }),
      Rental.countDocuments({ endDate: range, status: "completed" }),
      Client.countDocuments({ createdAt: range }),
      Payment.aggregate([
        { $match: { createdAt: range } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Rental.aggregate([
        { $match: { createdAt: range } },
        { $group: { _id: null, total: { $sum: "$depositAmount" } } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: range } },
        {
          $group: {
            _id: "$client",
            totalPaid: { $sum: "$amount" },
          },
        },
        { $sort: { totalPaid: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "clients",
            localField: "_id",
            foreignField: "_id",
            as: "clientInfo",
          },
        },
        { $unwind: "$clientInfo" },
        { $project: { fullName: "$clientInfo.fullName", totalPaid: 1 } },
      ]),
      // Eng ko'p ijaraga berilgan jihozlar ARENDALARDAN hisoblanadi.
      // Ilgari `Payment` dan hisoblanardi: bir arendaga 3 to'lov qilinsa
      // jihozlar 3 marta sanalardi, to'lanmagan arenda esa reytingga
      // umuman tushmasdi.
      Rental.aggregate([
        { $match: { createdAt: range } },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.equipment",
            name: { $first: "$items.equipmentName" },
            rentalCount: { $addToSet: "$_id" },
            totalQuantity: { $sum: "$items.quantity" },
          },
        },
        {
          $project: {
            name: 1,
            totalQuantity: 1,
            rentalCount: { $size: "$rentalCount" },
          },
        },
        { $sort: { rentalCount: -1, totalQuantity: -1 } },
        { $limit: 5 },
      ]),
      this.getDailyRevenue(startDate, endDate),
    ]);

    const paymentsReceived = paymentsData[0]?.total || 0;
    const depositsReceived = depositsData[0]?.total || 0;

    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      timezone: APP_TZ,
      // Kassa (cash) tamoyili: haqiqatda tushgan pul.
      // Ilgari `revenue` = arendalarning `depositAmount` yig'indisi edi —
      // to'lovlar bu raqamga umuman kirmasdi, omonat 0 bo'lsa daromad 0 edi.
      // Omonat `Payment` hujjati sifatida yozilmaydi, shuning uchun alohida
      // qo'shiladi (ikki marta sanalmaydi).
      revenue: paymentsReceived + depositsReceived,
      paymentsReceived,
      depositsReceived,
      newRentals,
      closedRentals,
      newClients,
      topClients: topClients.map((c: any) => ({ fullName: c.fullName, totalPaid: c.totalPaid })),
      topEquipment: topEquipment.map((e: any) => ({
        name: e.name,
        rentalCount: e.rentalCount,
        totalQuantity: e.totalQuantity,
      })),
      dailyRevenue,
    };
  }

  /**
   * Muddati o'tgan arendalar. Worker uchun ro'yxat o'zi ochgan arendalar bilan
   * cheklanadi — ilgari bu endpoint barcha mijozlar va telefon raqamlarini
   * har qanday xodimga ochib berardi.
   */
  async getOverdue(actor: Actor) {
    const today = startOfTzDay(new Date());

    // Cron arendani `overdue` holatiga o'tkazadi. Ilgari bu so'rov faqat
    // `status: "active"` ni izlardi — natijada cron ishlagan zahoti arenda
    // muddati o'tganlar hisobotidan butunlay yo'qolib qolardi.
    const query: Record<string, unknown> = {
      status: { $in: OPEN_STATUSES },
      expectedEndDate: { $lt: today },
    };
    if (!isAdmin(actor.role)) query.createdBy = actor.id;

    const overdueRentals = await Rental.find(query)
      .populate("client", "fullName phone telegramId")
      .sort({ expectedEndDate: 1 });

    return overdueRentals.map((rental) => {
      const calc = calculateRental(rental);
      return {
        _id: rental._id,
        rentalNumber: rental.rentalNumber,
        client: rental.client,
        status: rental.status,
        expectedEndDate: rental.expectedEndDate,
        overdueDays: Math.max(inclusiveTzDayCount(rental.expectedEndDate!, today) - 1, 0),
        totalAmount: calc.totalAmount,
        paidAmount: calc.paidAmount,
        depositAmount: calc.depositAmount,
        debt: calc.debt,
        items: calc.items.map((item) => ({
          equipmentName: item.equipmentName,
          activeQuantity: item.activeQuantity,
        })),
      };
    });
  }

  /**
   * Kunlik to'lovlar. Kalitlar ham, guruhlash ham bitta vaqt mintaqasida
   * bajariladi. Ilgari kalitlar `toISOString()` bilan (UTC) yasalib,
   * `$dateToString` esa UTC bo'yicha guruhlardi — server mintaqasi UTC
   * bo'lmasa kalitlar mos kelmay, kunlar siljib ketardi.
   */
  private async getDailyRevenue(startDate: Date, endDate: Date) {
    const dailyData = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: APP_TZ } },
          amount: { $sum: "$amount" },
        },
      },
    ]);

    const byDate = new Map<string, number>(dailyData.map((d: any) => [d._id, d.amount]));

    const result: { date: string; amount: number }[] = [];
    const dayCount = inclusiveTzDayCount(startDate, endDate);
    for (let i = 0; i < dayCount; i++) {
      const key = tzDateKey(addTzDays(startDate, i));
      result.push({ date: key, amount: byDate.get(key) || 0 });
    }

    return result;
  }
}

export const reportService = new ReportService();
