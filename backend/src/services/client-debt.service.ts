import { Client } from "../models/Client";
import { Rental } from "../models/Rental";
import { calculateRental } from "./rental-calc";

/**
 * MIJOZ QARZINI QAYTA HISOBLASH — `Client.totalDebt` uchun yagona manba.
 *
 * Ilgari bu funksiya `depositAmount - paidAmount` ni hisoblardi, ya'ni
 * hisoblangan arenda puliga umuman aloqasi yo'q edi: mijoz 30 kun jihoz
 * ishlatib hech narsa to'lamasa ham, omonat 0 bo'lsa qarz 0 chiqardi.
 * Endi qarz `rental-calc` orqali haqiqiy kunlik hisobdan olinadi.
 *
 * NEGA BARCHA ARENDALAR (yopilganlari ham) SANALADI:
 * Ilgari faqat `active`/`overdue` arendalar qo'shilardi. Natijada arenda
 * yopilgan zahoti qarz YO'QOLARDI — mijoz to'lamasdan ketsa ham qarzdorlar
 * ro'yxatidan tushib qolardi. Yopilgan arendaning hisobi `resolveCheckDate`
 * tufayli `endDate` da MUZLAYDI (kun qo'shilib o'smaydi), shuning uchun
 * ularni qo'shish xavfsiz: raqam o'zgarmas qoladi va to'lov kiritilishi
 * bilan o'zi kamayadi.
 *
 * NEGA `Debt` hujjatlari bu yerda QO'SHILMAYDI:
 * `debtService.pay` to'lovni `paymentService.create` orqali o'tkazadi, ya'ni
 * u arendaning `paidAmount` ini oshiradi va arenda qarzini kamaytiradi.
 * Shuning uchun `Debt.amount` va arenda qarzi — BIR XIL pul. Ikkalasini
 * qo'shsak, qarz ikki barobar ko'rinadi. Arenda hisobi — yagona manba,
 * `Debt` hujjatlari esa faqat muddat/eslatma qatlami (dueDate, status).
 * Bu yerga `Debt` summasini qo'shmang.
 */
export async function recalculateClientDebt(clientId: string): Promise<number> {
  const rentals = await Rental.find({ client: clientId });

  let totalDebt = 0;
  for (const rental of rentals) {
    // `calculateRental.debt` allaqachon 0 dan past tushmaydi (ortiqcha to'lov
    // alohida `overpaid` maydonida) — bir arendaning ortiqcha to'lovi
    // boshqasining qarzini yashirmasligi uchun.
    totalDebt += calculateRental(rental).debt;
  }

  await Client.updateOne({ _id: clientId }, { $set: { totalDebt } });
  return totalDebt;
}

/** Barcha mijozlar qarzini qayta hisoblash (cron va migratsiya uchun). */
export async function recalculateAllClientDebts(): Promise<number> {
  // DIQQAT: bu yerda ham holat bo'yicha filtr YO'Q. Agar bu ro'yxat faqat
  // faol arendalardan yig'ilsa, quyidagi `updateMany` yopilgan arendasi bor
  // mijozlarning endigina hisoblangan qarzini nolga tushirib yuboradi.
  const clientIds = await Rental.distinct("client");
  for (const id of clientIds) {
    await recalculateClientDebt(id.toString());
  }
  // Umuman arendasi yo'q mijozlarda eski qarz osilib qolmasligi kerak
  await Client.updateMany(
    { _id: { $nin: clientIds }, totalDebt: { $ne: 0 } },
    { $set: { totalDebt: 0 } },
  );
  return clientIds.length;
}
