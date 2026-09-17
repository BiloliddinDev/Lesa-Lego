import { Payment } from "../models/Payment";
import { Rental } from "../models/Rental";
import { AuditLog } from "../models/AuditLog";
import { notifyService } from "./notify.service";
import { recalculateClientDebt } from "./client-debt.service";
import { Actor, assertRentalOwnership, isAdmin, ownRentalIds } from "./access.service";
import { syncDebtStatus } from "./debt-status.service";
import { AppError } from "../utils/AppError";

/**
 * Asosiy yozuv bazaga tushgandan KEYINGI yon amallar. Xatosi asosiy amalni
 * bekor qilmaydi — qarz sanog'i `POST /api/reports/reconcile` yoki server
 * qayta ishga tushganda tiklanadi.
 */
async function runPostCommit(action: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[PostCommit] ${action} yon amallari bajarilmadi:`, err);
  }
}

export class PaymentService {
  /**
   * To'lovlar ro'yxati. Worker faqat O'ZI OCHGAN arendalarning to'lovlarini
   * ko'radi (admin kiritgan to'lov ham shu arendaga tegishli bo'lsa ko'rinadi).
   * Ilgari filtr umuman yo'q edi — har qanday xodim butun kassa oborotini
   * ko'rardi.
   */
  async getAll(
    filters: {
      rentalId?: string;
      clientId?: string;
      method?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
    actor: Actor,
  ) {
    const query: Record<string, unknown> = {};

    if (filters.rentalId) query.rental = filters.rentalId;
    if (filters.clientId) query.client = filters.clientId;
    if (filters.method) query.method = filters.method;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) (query.createdAt as any).$gte = new Date(filters.from);
      if (filters.to) (query.createdAt as any).$lte = new Date(filters.to);
    }

    if (!isAdmin(actor.role)) {
      if (filters.rentalId) {
        // Begona arendaning to'lovlarini so'rasa — bo'sh emas, 403 qaytadi
        await assertRentalOwnership(filters.rentalId, actor);
      } else {
        query.rental = { $in: await ownRentalIds(actor.id) };
      }
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
    actor: Actor,
  ) {
    const userId = actor.id;
    const rental = await Rental.findById(data.rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    // Worker begona arendaga to'lov kirita olmaydi
    if (!isAdmin(actor.role) && rental.createdBy.toString() !== actor.id) {
      throw new AppError("Sizga ruxsat berilmagan", 403);
    }

    // Ilgari faqat `status === "active"` ga to'lov qilinardi. Cron arendani
    // `overdue` ga o'tkazgan zahoti — aynan qarzi bor arendaga — to'lov
    // kiritish imkonsiz bo'lib qolardi. Yopilgan arendaga ham to'lov
    // qilinishi kerak: qarz yopilgandan keyin ham qolishi mumkin.

    const payment = await Payment.create({
      rental: rental._id,
      client: rental.client,
      amount: data.amount,
      method: data.method,
      note: data.note,
      createdBy: userId,
    });

    await Rental.updateOne({ _id: rental._id }, { $inc: { paidAmount: data.amount } });

    // To'lov allaqachon yozilgan — yon amallarning xatosi so'rovni yiqitmasligi
    // kerak, aks holda xodim "xato" deb o'ylab to'lovni ikkinchi marta
    // kiritib yuborishi mumkin.
    await runPostCommit("payment.create", async () => {
      await recalculateClientDebt(rental.client.toString());
      // Arenda to'liq to'langan bo'lsa nasiya hujjati "paid" ga o'tadi
      await syncDebtStatus(rental._id);
      await AuditLog.create({
        userId,
        action: "payment.create",
        resourceType: "payment",
        resourceId: payment._id,
        resourceName: "To'lov " + data.amount + " so'm",
        after: { rentalId: data.rentalId, amount: data.amount, method: data.method },
      });
      notifyService.paymentReceived(payment, rental.rentalNumber).catch(console.error);
    });

    return payment;
  }

  async delete(paymentId: string, userId: string) {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new AppError("To'lov topilmadi", 404);

    const rental = await Rental.findById(payment.rental);
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    await Rental.updateOne({ _id: rental._id }, { $inc: { paidAmount: -payment.amount } });
    await Payment.findByIdAndDelete(paymentId);

    await runPostCommit("payment.delete", async () => {
      await recalculateClientDebt(rental.client.toString());
      await syncDebtStatus(rental._id);
      await AuditLog.create({
        userId,
        action: "payment.delete",
        resourceType: "payment",
        resourceId: payment._id,
        resourceName: "To'lov bekor qilindi " + payment.amount + " so'm",
        before: {
          amount: payment.amount,
          method: payment.method,
          rentalId: payment.rental.toString(),
        },
      });
    });

    return { message: "To'lov bekor qilindi" };
  }
}

export const paymentService = new PaymentService();
