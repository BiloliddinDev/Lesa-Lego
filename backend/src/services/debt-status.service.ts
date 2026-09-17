import mongoose from "mongoose";
import { Debt } from "../models/Debt";
import { Rental } from "../models/Rental";
import { calculateRental } from "./rental-calc";

/**
 * QARZ HUJJATINI ARENDA HISOBIGA MOSLASH.
 *
 * Pulning yagona manbasi — arenda hisobi (`rental-calc`). Shuning uchun
 * qarz hujjatining summasi bu yerda QAYTA YOZILMAYDI: arenda to'liq
 * to'langanda hujjat shunchaki "paid" holatiga o'tadi. Aks holda ikkita
 * bir-biriga qarama-qarshi raqam paydo bo'lardi.
 *
 * Bu funksiya to'lovdan keyin chaqiriladi: xodim arenda sahifasida to'lov
 * kiritsa ham (`/debts/:id/pay` orqali emas), qarzdorlar ro'yxatida eski
 * "pending" yozuv osilib qolmaydi.
 */
export async function syncDebtStatus(
  rentalId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const rental = await Rental.findById(rentalId);
  if (!rental) return;

  if (calculateRental(rental).debt > 0) {
    // To'lov bekor qilinsa qarz qaytadi — hujjat ham "pending" ga qaytishi
    // kerak, aks holda qarzdorlar ro'yxati to'langan deb ko'rsatib turadi.
    await Debt.updateMany(
      { rental: rental._id, status: "paid" },
      { $set: { status: "pending" }, $unset: { paidDate: "" } },
    );
    return;
  }

  await Debt.updateMany(
    { rental: rental._id, status: { $ne: "paid" } },
    { $set: { status: "paid", paidDate: new Date() } },
  );
}
