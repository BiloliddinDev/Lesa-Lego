import { Debt } from "../models/Debt";
import { Rental } from "../models/Rental";
import { Client } from "../models/Client";
import { AuditLog } from "../models/AuditLog";
import { paymentService } from "./payment.service";
import { recalculateClientDebt } from "./client-debt.service";
import { syncDebtStatus } from "./debt-status.service";
import { Actor, assertRentalOwnership, isAdmin, ownRentalIds } from "./access.service";
import { AppError } from "../utils/AppError";

/**
 * QARZ HUJJATLARI — muddat va eslatma qatlami.
 *
 * `Client.totalDebt` bu yerdan HISOBLANMAYDI: u arendaning haqiqiy kunlik
 * hisobidan olinadi (`client-debt.service.ts` ga qarang). Ilgari `create`
 * `$inc: { totalDebt }` qilardi, keyin har qanday to'lov `totalDebt` ni
 * butunlay ustidan yozib, bu qo'shimchani yo'q qilardi — va ikki manba
 * bir-biriga qarama-qarshi raqam berardi. Endi yagona manba — arenda hisobi.
 */
export class DebtService {
  /**
   * Qarzlar ro'yxati. To'lovlar bilan bir xil doira: worker faqat o'zi ochgan
   * arendalarga tegishli qarzlarni ko'radi.
   */
  async getAll(
    filters: { status?: string; clientId?: string; page?: number; limit?: number },
    actor: Actor,
  ) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.client = filters.clientId;
    if (!isAdmin(actor.role)) {
      query.rental = { $in: await ownRentalIds(actor.id) };
    }

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

  async create(
    data: {
      clientId: string;
      rentalId: string;
      amount: number;
      dueDate?: string;
      note?: string;
    },
    actor: Actor,
  ) {
    // Worker faqat o'z arendasiga qarz hujjati ocha oladi
    await assertRentalOwnership(data.rentalId, actor);

    const client = await Client.findById(data.clientId);
    if (!client) throw new AppError("Mijoz topilmadi", 404);

    const rental = await Rental.findById(data.rentalId);
    if (!rental) throw new AppError("Arenda topilmadi", 404);

    // Arenda boshqa mijozga tegishli bo'lsa qarz hujjati ma'nosiz bo'ladi
    if (rental.client.toString() !== data.clientId) {
      throw new AppError("Bu arenda ko'rsatilgan mijozga tegishli emas", 400);
    }

    return Debt.create({
      client: data.clientId,
      rental: data.rentalId,
      amount: data.amount,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      note: data.note,
      status: "pending",
    });
  }

  async pay(debtId: string, data: { amount: number; method: string; note?: string }, actor: Actor) {
    const userId = actor.id;
    const debt = await Debt.findById(debtId);
    if (!debt) throw new AppError("Qarz topilmadi", 404);

    // Worker begona arendaning qarzini to'lay olmaydi (to'lov o'sha arendaga yoziladi)
    await assertRentalOwnership(debt.rental, actor);

    if (debt.status === "paid") throw new AppError("Qarz allaqachon to'langan", 400);
    if (data.amount > debt.amount) {
      throw new AppError("To'lov miqdori qarzdan ko'p bo'lishi mumkin emas", 400);
    }

    const payment = await paymentService.create(
      { rentalId: debt.rental.toString(), amount: data.amount, method: data.method, note: data.note },
      actor,
    );

    // Qolgan summani SAQLAYMIZ. Ilgari `newAmount` faqat hisoblanib qo'yilardi,
    // `debt.amount` ga yozilmasdi — qismi to'lov saqlanmay, qarzni yana
    // to'liq summada cheksiz marta "to'lash" mumkin bo'lardi.
    const remaining = debt.amount - data.amount;
    debt.amount = Math.max(remaining, 0);
    if (remaining <= 0) {
      debt.status = "paid";
      debt.paidDate = new Date();
    }
    await debt.save();

    await recalculateClientDebt(debt.client.toString());
    // Arenda hisobiga qarab hujjat holatini yakuniy moslash (qarz hujjati
    // summasi arenda qarzidan katta bo'lgan hollarda ham to'g'ri yopiladi)
    await syncDebtStatus(debt.rental);

    await AuditLog.create({
      userId,
      action: "debt.pay",
      resourceType: "debt",
      resourceId: debt._id,
      resourceName: "Qarz to'lovi " + data.amount + " so'm",
      after: { amount: data.amount, method: data.method, remainingAmount: debt.amount },
    });

    return { debt, payment };
  }
}

export const debtService = new DebtService();
