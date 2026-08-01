import { Rental } from "../models/Rental";
import { Payment } from "../models/Payment";
import { Client } from "../models/Client";
import { Equipment } from "../models/Equipment";
import mongoose from "mongoose";

export class ReportService {
  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      activeRentals,
      overdueRentals,
      totalDebtors,
      totalDebt,
      equipmentStats,
      todayStats,
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
      Promise.all([
        Rental.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
        Rental.countDocuments({ endDate: { $gte: today, $lt: tomorrow } }),
        Payment.aggregate([
          { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Client.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      ]),
    ]);

    return {
      today: today.toISOString().split("T")[0],
      activeRentals,
      overdueRentals,
      totalDebtors,
      totalDebt: totalDebt[0]?.total || 0,
      equipmentStats: {
        totalOut: equipmentStats[0]?.totalOut || 0,
        totalAvailable: equipmentStats[0]?.totalAvailable || 0,
      },
      todayStats: {
        newRentals: todayStats[0],
        closedRentals: todayStats[1],
        paymentsReceived: todayStats[2][0]?.total || 0,
        newClients: todayStats[3],
      },
    };
  }

  async getMonthly(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [
      revenueData,
      newRentals,
      closedRentals,
      newClients,
      paymentsData,
      topClients,
      topEquipment,
      dailyRevenue,
    ] = await Promise.all([
      Rental.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$depositAmount" } } },
      ]),
      Rental.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Rental.countDocuments({ endDate: { $gte: startDate, $lte: endDate }, status: "completed" }),
      Client.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: "clients",
            localField: "client",
            foreignField: "_id",
            as: "clientInfo",
          },
        },
        { $unwind: "$clientInfo" },
        {
          $group: {
            _id: "$client",
            fullName: { $first: "$clientInfo.fullName" },
            totalPaid: { $sum: "$amount" },
          },
        },
        { $sort: { totalPaid: -1 } },
        { $limit: 5 },
      ]),
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $lookup: {
            from: "rentals",
            localField: "rental",
            foreignField: "_id",
            as: "rentalInfo",
          },
        },
        { $unwind: "$rentalInfo" },
        {
          $lookup: {
            from: "rentals",
            let: { rentalId: "$rental" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$rentalId"] } } },
              { $unwind: "$items" },
              { $replaceRoot: { newRoot: "$items" } },
            ],
            as: "rentalItems",
          },
        },
        { $unwind: "$rentalItems" },
        {
          $group: {
            _id: "$rentalItems.equipment",
            name: { $first: "$rentalItems.equipmentName" },
            rentalCount: { $sum: 1 },
          },
        },
        { $sort: { rentalCount: -1 } },
        { $limit: 5 },
      ]),
      this.getDailyRevenue(startDate, endDate),
    ]);

    return {
      period: `${year}-${String(month).padStart(2, "0")}`,
      revenue: revenueData[0]?.total || 0,
      newRentals,
      closedRentals,
      newClients,
      paymentsReceived: paymentsData[0]?.total || 0,
      topClients: topClients.map((c) => ({ fullName: c.fullName, totalPaid: c.totalPaid })),
      topEquipment: topEquipment.map((e) => ({ name: e.name, rentalCount: e.rentalCount })),
      dailyRevenue,
    };
  }

  async getOverdue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueRentals = await Rental.find({
      status: "active",
      expectedEndDate: { $lt: today },
    })
      .populate("client", "fullName phone telegramId")
      .populate("items.equipment", "name");

    return overdueRentals.map((rental) => {
      const expectedEnd = new Date(rental.expectedEndDate!);
      const diffTime = today.getTime() - expectedEnd.getTime();
      const overdueDays = Math.ceil(diffTime / 86400000);

      return {
        rentalNumber: rental.rentalNumber,
        client: rental.client,
        expectedEndDate: rental.expectedEndDate,
        overdueDays,
        items: rental.items.map((item) => ({
          equipmentName: item.equipmentName,
          activeQuantity: item.quantity - item.returnedQuantity,
        })),
      };
    });
  }

  private async getDailyRevenue(startDate: Date, endDate: Date) {
    const dailyData = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Barcha kunlarni to'ldirish (0 bilan)
    const result: { date: string; amount: number }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const found = dailyData.find((d) => d._id === dateStr);
      result.push({ date: dateStr, amount: found?.amount || 0 });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }
}

export const reportService = new ReportService();
