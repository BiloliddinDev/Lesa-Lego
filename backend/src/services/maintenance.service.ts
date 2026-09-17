import { Equipment } from "../models/Equipment";
import { Rental } from "../models/Rental";
import { recalculateAllClientDebts } from "./client-debt.service";

/**
 * BAZANI TUZATISH (reconciliation).
 *
 * Eski xatolar bazada iz qoldirgan, shuning uchun kodni tuzatish yetarli emas:
 *  - `closeRental` dagi `$set: { rentedQuantity: 0 }` jihozlarning global band
 *    sanog'ini buzgan (boshqa faol arendalardagi miqdorlar yo'qolgan);
 *  - `Client.totalDebt` `depositAmount - paidAmount` formulasi bilan yozilgan.
 *
 * Bu funksiyalar haqiqiy holatni arendalardan qayta hisoblaydi.
 */

/**
 * Har bir jihozning `rentedQuantity` sini yopilmagan arendalardagi faol
 * miqdorlar yig'indisidan qayta hisoblaydi.
 */
export async function reconcileEquipmentStock(): Promise<{ checked: number; fixed: number }> {
  const actual = await Rental.aggregate<{ _id: any; rented: number }>([
    { $match: { status: { $in: ["active", "overdue"] } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.equipment",
        rented: { $sum: { $subtract: ["$items.quantity", "$items.returnedQuantity"] } },
      },
    },
  ]);

  const expected = new Map<string, number>(
    actual.map((row) => [row._id.toString(), Math.max(row.rented, 0)]),
  );

  const equipments = await Equipment.find().select("rentedQuantity totalQuantity name");
  let fixed = 0;

  for (const eq of equipments) {
    const want = expected.get(eq._id.toString()) || 0;
    if (eq.rentedQuantity !== want) {
      console.warn(
        `[Reconcile] ${eq.name}: rentedQuantity ${eq.rentedQuantity} → ${want}`,
      );
      await Equipment.updateOne({ _id: eq._id }, { $set: { rentedQuantity: want } });
      fixed++;
    }
  }

  return { checked: equipments.length, fixed };
}

/** Ombor sanog'i va mijoz qarzlarini birgalikda qayta hisoblaydi. */
export async function reconcileAll() {
  const stock = await reconcileEquipmentStock();
  const clients = await recalculateAllClientDebts();
  return { stock, clientsRecalculated: clients };
}
