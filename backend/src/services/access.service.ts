import mongoose from "mongoose";
import { Rental } from "../models/Rental";
import { AppError } from "../utils/AppError";

/**
 * RUXSAT DOIRASI — worker nimani ko'rishi va o'zgartirishi mumkinligi.
 *
 * Qoida: ADMIN hamma narsani ko'radi; WORKER esa FAQAT o'zi ochgan
 * arendalar doirasida ishlaydi. "O'ziniki" — arendaga bog'lanadi, yozuvni
 * kim kiritganiga emas: shunda admin worker arendasiga to'lov kiritsa ham,
 * o'sha to'lov arenda sahifasida ko'rinadi.
 *
 * Ilgari bu tekshiruv faqat `GET /rentals/:id`, `/check` va `/pdf` da bor edi —
 * qaytarish, yopish, to'lov va ro'yxat endpointlari ochiq qolgan, ya'ni worker
 * boshqa xodimning arendasini yopib, unga to'lov kiritishi mumkin edi.
 */

export interface Actor {
  id: string;
  role: string;
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN";
}

/** Xodim o'zi ochgan arendalar ro'yxati (ro'yxat endpointlarini cheklash uchun). */
export async function ownRentalIds(userId: string): Promise<mongoose.Types.ObjectId[]> {
  return Rental.distinct("_id", { createdBy: userId });
}

/**
 * Arenda shu xodimga tegishlimi. Admin uchun har doim o'tadi.
 * Arenda yo'q bo'lsa 404, begona bo'lsa 403.
 */
export async function assertRentalOwnership(
  rentalId: string | mongoose.Types.ObjectId,
  actor: Actor,
): Promise<void> {
  const rental = await Rental.findById(rentalId).select("createdBy");
  if (!rental) throw new AppError("Arenda topilmadi", 404);
  if (!isAdmin(actor.role) && rental.createdBy.toString() !== actor.id) {
    throw new AppError("Sizga ruxsat berilmagan", 403);
  }
}
