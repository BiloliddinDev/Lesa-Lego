import { Payment } from "../models/Payment";
import { Rental } from "../models/Rental";
import { Client } from "../models/Client";
import { AuditLog } from "../models/AuditLog";
import { notifyService } from "./notify.service";
import { AppError } from "../utils/AppError";

export class PaymentService {
  async getAll(filters: {
    rentalId?: string;
    clientId?: string;
    method?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};

    if (filters.rentalId) query.rental = filters.rentalId;
    if (filters.clientId) query.client = filters.clientId;
    if (filters.method) query.method = filters.method;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) (query.createdAt as any).$gte = new Date(filters.from);
      if (filters.to) (query.createdAt as any).$lte = new Date(filters.to);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("rental", "rentalNumber")
        .populate("client", "fullName")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments(query),
    ]);

    return {
      data: payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(
    data: { rentalId: string; amount: number; method: string; note?: string },
    userId: string,
  ) {
    const rental = await Rental.findById(data.rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);
    if (rental.status !== "active") {
      throw new AppError("Faqat faol arendaga to'lov qilish mumkin", 400);
    }

    const payment = await Payment.create({
      rental: rental._id,
      client: rental.client,
      amount: data.amount,
      method: data.method,
      note: data.note,
      createdBy: userId,
    });

    // Rental.paidAmount yangilash
    await Rental.findByIdAndUpdate(rental._id, {
      $inc: { paidAmount: data.amount },
    });

    // Client.totalDebt yangilash
    await this.recalculateClientDebt(rental.client.toString());

    // Audit Log
    await AuditLog.create({
      userId,
      action: "payment.create",
      resourceType: "payment",
      resourceId: payment._id,
      resourceName: `To'lov ${data.amount} so'm`,
      after: { rentalId: data.rentalId, amount: data.amount, method: data.method },
    });

    // Notification
    notifyService.paymentReceived(payment, rental.rentalNumber).catch(console.error);

    return payment;
  }

  async delete(paymentId: string, userId: string) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new AppError("To'lov topilmadi", 404);

    const rental = await Rental.findById(payment.rental);
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    // Rental.paidAmount dan ayirish
    await Rental.findByIdAndUpdate(rental._id, {
      $inc: { paidAmount: -payment.amount },
    });

    // To'lovni o'chirish
    await Payment.findByIdAndDelete(paymentId);

    // Client.totalDebt yangilash
    await this.recalculateClientDebt(rental.client.toString());

    // Audit Log
    await AuditLog.create({
      userId,
      action: "payment.delete",
      resourceType: "payment",
      resourceId: payment._id,
      resourceName: `To'lov bekor qilindi ${payment.amount} so'm`,
      before: { amount: payment.amount, method: payment.method, rentalId: payment.rental.toString() },
    });

    return { message: "To'lov bekor qilindi" };
  }

  private async recalculateClientDebt(clientId: string) {
    const client = await Client.findById(clientId);
    if (!client) return;

    // Active rental lar uchun qarzni hisoblash
    const activeRentals = await Rental.find({
      client: clientId,
      status: { $in: ["active", "overdue"] },
    });

    let totalDebt = 0;
    for (const rental of activeRentals) {
      // To'liq qarz = depositAmount - paidAmount + to'lanmagan qarz
      // depositAmount omonat sifatida, paidAmount to'langan summa
      // Agar paidAmount deposit dan kichik bo'lsa, qarz bor
      const outstandingAmount = rental.depositAmount - rental.paidAmount;
      if (outstandingAmount > 0) totalDebt += outstandingAmount;
    }

    client.totalDebt = totalDebt;
    await client.save();
  }
}

export const paymentService = new PaymentService();
