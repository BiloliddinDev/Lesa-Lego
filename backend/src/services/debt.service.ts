import { Debt } from "../models/Debt";
import { Rental } from "../models/Rental";
import { Client } from "../models/Client";
import { AuditLog } from "../models/AuditLog";
import { paymentService } from "./payment.service";
import { AppError } from "../utils/AppError";

export class DebtService {
  async getAll(filters: {
    status?: string;
    clientId?: string;
    page?: number;
    limit?: number;
  }) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.client = filters.clientId;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [debts, total] = await Promise.all([
      Debt.find(query)
        .populate("client", "fullName phone")
        .populate("rental", "rentalNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Debt.countDocuments(query),
    ]);

    return { data: debts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async create(data: { clientId: string; rentalId: string; amount: number; dueDate?: string; note?: string }) {
    const client = await Client.findById(data.clientId);
    if (!client) throw new AppError("Mijoz topilmadi", 404);

    const rental = await Rental.findById(data.rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    const debt = await Debt.create({
      client: data.clientId,
      rental: data.rentalId,
      amount: data.amount,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      note: data.note,
      status: "pending",
    });

    // Client.totalDebt oshirish
    await Client.findByIdAndUpdate(data.clientId, { $inc: { totalDebt: data.amount } });

    return debt;
  }

  async pay(debtId: string, data: { amount: number; method: string; note?: string }, userId: string) {
    const debt = await Debt.findById(debtId);
    if (!debt) throw new AppError("Qarz topilmadi", 404);
    if (debt.status === "paid") throw new AppError("Qarz allaqachon to'langan", 400);
    if (data.amount > debt.amount) throw new AppError("To'lov miqdori qarzdan ko'p bo'lishi mumkin emas", 400);

    // Payment yaratish (payment service orqali)
    const payment = await paymentService.create(
      { rentalId: debt.rental.toString(), amount: data.amount, method: data.method, note: data.note },
      userId,
    );

    // Debt status yangilash
    const newAmount = debt.amount - data.amount;
    if (newAmount <= 0) {
      debt.status = "paid";
      debt.paidDate = new Date();
    }
    await debt.save();

    // Audit Log
    await AuditLog.create({
      userId,
      action: "debt.pay",
      resourceType: "debt",
      resourceId: debt._id,
      resourceName: `Qarz to'lovi ${data.amount} so'm`,
      after: { amount: data.amount, method: data.method, remainingAmount: newAmount },
    });

    return { debt, payment };
  }
}

export const debtService = new DebtService();
