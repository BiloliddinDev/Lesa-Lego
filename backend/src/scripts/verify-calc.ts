/**
 * HISOB-KITOB TEKSHIRUVI — bazaga ulanmaydi, sof funksiyalarni sinaydi.
 *
 * Ishga tushirish:  npm run verify:calc
 *
 * Asosiy invariant: har bir jihoz uchun
 *   sum(segment.amount) === itemTotal === kunlik jadvalning oxirgi kumulativi
 *
 * Bu tekshiruv bejiz emas: ilgari segmentlar va kunlik jadval alohida
 * hisoblanib, bitta chekda ikki xil summa chiqarardi (190 000 va 210 000).
 * Hisob-kitobga tegilganda shu skript qayta ishga tushirilishi kerak.
 */
import { IRentalItem } from "../models/Rental";
import { calculateRental } from "../services/rental-calc";
import { inclusiveTzDayCount, tzDateKey, tzMonthRange } from "../utils/date";

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "OK  " : "XATO"}  ${name}${detail ? "  " + detail : ""}`);
}

function equals(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  check(name, ok, ok ? String(got) : `${JSON.stringify(got)} (kutilgan: ${JSON.stringify(want)})`);
}

const day = (iso: string) => new Date(`${iso}T09:00:00+05:00`);

function item(quantity: number, dailyRate: number, returns: { date: Date; quantity: number }[] = []) {
  return {
    equipmentName: "Jihoz",
    equipmentCategory: "Kategoriya",
    quantity,
    dailyRate,
    returnedQuantity: returns.reduce((s, r) => s + r.quantity, 0),
    returns,
  } as unknown as IRentalItem;
}

function rental(items: IRentalItem[], startDate: Date, endDate: Date, deposit = 0, paid = 0) {
  return { items, startDate, endDate, status: "completed", depositAmount: deposit, paidAmount: paid } as any;
}

console.log("\n=== 1. Invariant: segmentlar yig'indisi = jami summa ===");
const scenarios: { name: string; rental: any; expectedTotal?: number }[] = [
  {
    name: "qaytarishsiz 5 kun (10 × 5 000)",
    rental: rental([item(10, 5000)], day("2026-09-01"), day("2026-09-05")),
    expectedTotal: 250_000,
  },
  {
    name: "03.09 da 4 dona qaytarildi",
    rental: rental([item(10, 5000, [{ date: day("2026-09-03"), quantity: 4 }])], day("2026-09-01"), day("2026-09-05")),
    expectedTotal: 190_000,
  },
  {
    name: "1 kunlik arenda (7 × 3 000)",
    rental: rental([item(7, 3000)], day("2026-09-01"), day("2026-09-01")),
    expectedTotal: 21_000,
  },
  {
    name: "birinchi kuni to'liq qaytarildi",
    rental: rental([item(10, 5000, [{ date: day("2026-09-01"), quantity: 10 }])], day("2026-09-01"), day("2026-09-05")),
    expectedTotal: 0,
  },
  {
    name: "oxirgi kuni qaytarildi",
    rental: rental([item(10, 5000, [{ date: day("2026-09-05"), quantity: 10 }])], day("2026-09-01"), day("2026-09-05")),
    expectedTotal: 200_000,
  },
  {
    name: "bir kunda ikki marta qaytarish (3 + 2)",
    rental: rental(
      [item(10, 5000, [{ date: day("2026-09-03"), quantity: 3 }, { date: day("2026-09-03"), quantity: 2 }])],
      day("2026-09-01"),
      day("2026-09-05"),
    ),
    expectedTotal: 175_000,
  },
  {
    name: "yarim tunga yaqin qaytarish (23:50, UTC+5)",
    rental: rental(
      [item(10, 5000, [{ date: new Date("2026-09-03T23:50:00+05:00"), quantity: 4 }])],
      day("2026-09-01"),
      day("2026-09-05"),
    ),
    expectedTotal: 190_000,
  },
  {
    name: "hisob sanasidan keyingi qaytarish e'tiborga olinmaydi",
    rental: rental([item(10, 5000, [{ date: day("2026-09-20"), quantity: 10 }])], day("2026-09-01"), day("2026-09-05")),
    expectedTotal: 250_000,
  },
  {
    name: "ikki jihoz, har xil narx",
    rental: rental(
      [item(10, 5000, [{ date: day("2026-09-03"), quantity: 4 }]), item(4, 12000)],
      day("2026-09-01"),
      day("2026-09-05"),
      100_000,
      50_000,
    ),
    expectedTotal: 430_000,
  },
];

for (const s of scenarios) {
  const calc = calculateRental(s.rental);
  const scheduleTotal = calc.dailySchedule.length
    ? calc.dailySchedule[calc.dailySchedule.length - 1].cumulativeAmount
    : 0;
  const itemsTotal = calc.items.reduce((sum, i) => sum + i.itemTotal, 0);
  const segmentsTotal = calc.items.reduce(
    (sum, i) => sum + i.segments.reduce((s2, seg) => s2 + seg.amount, 0),
    0,
  );

  const consistent =
    scheduleTotal === calc.totalAmount &&
    itemsTotal === calc.totalAmount &&
    segmentsTotal === calc.totalAmount;

  check(
    s.name,
    consistent && (s.expectedTotal === undefined || calc.totalAmount === s.expectedTotal),
    `jami=${calc.totalAmount} jadval=${scheduleTotal} segmentlar=${segmentsTotal}`,
  );
}

console.log("\n=== 2. Qarz va ortiqcha to'lov (omonat = avans) ===");
{
  // 250 000 jami, 100 000 omonat, 50 000 to'lov → 100 000 qarz
  const c = calculateRental(rental([item(10, 5000)], day("2026-09-01"), day("2026-09-05"), 100_000, 50_000));
  equals("qarz", c.debt, 100_000);
  equals("ortiqcha to'lov", c.overpaid, 0);
}
{
  // 250 000 jami, 200 000 omonat, 100 000 to'lov → 50 000 ortiqcha
  const c = calculateRental(rental([item(10, 5000)], day("2026-09-01"), day("2026-09-05"), 200_000, 100_000));
  equals("qarz (ortiqcha to'langanda 0)", c.debt, 0);
  equals("ortiqcha to'lov", c.overpaid, 50_000);
}

console.log("\n=== 3. Kelajakdagi arenda ===");
{
  const c = calculateRental({
    items: [item(5, 1000)],
    startDate: day("2099-01-01"),
    endDate: undefined,
    status: "active",
    depositAmount: 0,
    paidAmount: 0,
  } as any);
  equals("kun soni", c.days, 0);
  equals("jami summa", c.totalAmount, 0);
}

console.log("\n=== 4. Vaqt mintaqasi (sana chegaralari) ===");
equals("19:00 UTC → keyingi kun (UTC+5)", tzDateKey(new Date("2026-09-01T19:00:00Z")), "2026-09-02");
equals("18:00 UTC → o'sha kun", tzDateKey(new Date("2026-09-01T18:00:00Z")), "2026-09-01");
{
  const r = tzMonthRange(2026, 9);
  equals("sentabr boshi", tzDateKey(r.start), "2026-09-01");
  equals("sentabr oxiri", tzDateKey(r.end), "2026-09-30");
  equals("sentabrda kun soni", inclusiveTzDayCount(r.start, r.end), 30);
  const feb = tzMonthRange(2028, 2);
  equals("kabisa fevral (2028)", inclusiveTzDayCount(feb.start, feb.end), 29);
}

console.log(
  `\n${failures === 0 ? "✅ Barcha tekshiruvlar o'tdi" : `❌ ${failures} ta tekshiruv muvaffaqiyatsiz`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
