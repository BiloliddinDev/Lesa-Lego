import { IRental, IRentalItem } from "../models/Rental";
import { addTzDays, inclusiveTzDayCount, startOfTzDay, tzDateKey, tzToday } from "../utils/date";

/**
 * ARENDA HISOB-KITOBINING YAGONA MANBASI.
 *
 * Bu modul — sof (pure) funksiyalar to'plami. Chek, PDF, mijoz qarzi va
 * hisobotlar HAMMASI shu yerdan hisoblanadi. Ilgari kunlik jadval va
 * segmentlar alohida-alohida hisoblanib, bitta chekda ikki xil summa
 * chiqardi — endi segmentlar kunlik jadvaldan hosil qilinadi, shuning uchun
 * segmentlar yig'indisi jami summaga aynan teng bo'lishi kafolatlangan.
 *
 * Qabul qilingan biznes qoidalari:
 *  1. Kunlar ikki chegara bilan sanaladi: 01.09 → 05.09 = 5 kun.
 *  2. Jihoz qaytarilgan kundan boshlab pul olinmaydi (o'sha kun kamaytirilgan
 *     miqdor bilan hisoblanadi).
 *  3. `depositAmount` — oldindan to'lov (avans), arenda puliga hisoblanadi:
 *     qarz = jami − omonat − to'langan.
 *  4. Kun chegaralari biznes vaqt mintaqasi (APP_TZ) bo'yicha aniqlanadi.
 */

export interface DailyRow {
  date: string;
  dayNumber: number;
  quantity: number;
  dailyAmount: number;
  cumulativeAmount: number;
}

export interface Segment {
  from: string;
  to: string;
  quantity: number;
  days: number;
  amount: number;
}

export interface ItemCalc {
  equipment: string;
  equipmentName: string;
  equipmentCategory: string;
  quantity: number;
  returnedQuantity: number;
  activeQuantity: number;
  dailyRate: number;
  days: number;
  segments: Segment[];
  itemTotal: number;
}

export interface RentalCalc {
  startDate: Date;
  checkDate: Date;
  days: number;
  items: ItemCalc[];
  dailySchedule: Omit<DailyRow, "quantity">[];
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  debt: number;
  overpaid: number;
}

type RentalLike = Pick<IRental, "items" | "startDate" | "endDate" | "status" | "depositAmount" | "paidAmount">;

/**
 * Hisob qaysi sanagacha yuritiladi.
 * Yopilgan arenda yopilish sanasida to'xtaydi; faol/muddati o'tgan arenda
 * bugungi kungacha hisoblanadi. Yopilish sanasi kelasida bo'lsa ham hisob
 * o'sha sanada to'xtaydi (arenda muzlatilgan).
 */
export function resolveCheckDate(rental: Pick<RentalLike, "status" | "endDate">): Date {
  if (rental.status === "completed" && rental.endDate) {
    return startOfTzDay(rental.endDate);
  }
  return tzToday();
}

/**
 * Bitta jihoz uchun kunlik jadval: har kun uchun faol miqdor, o'sha kungi
 * summa va kumulativ jami. Kelajakdagi arenda uchun bo'sh qaytaradi.
 */
export function buildItemSchedule(item: IRentalItem, startDate: Date, checkDate: Date): DailyRow[] {
  const rows: DailyRow[] = [];
  const firstDay = startOfTzDay(startDate);
  const lastDay = startOfTzDay(checkDate);

  if (firstDay > lastDay) return rows;

  // Qaytarishlarni kun kalitiga yig'ib olamiz (yarim tundagi siljishlardan himoya)
  const returnsByDay = new Map<string, number>();
  for (const ret of item.returns || []) {
    const key = tzDateKey(ret.date);
    returnsByDay.set(key, (returnsByDay.get(key) || 0) + ret.quantity);
  }

  let cursor = firstDay;
  let dayNumber = 1;
  let cumulative = 0;
  let returnedSoFar = 0;

  while (cursor <= lastDay) {
    const key = tzDateKey(cursor);
    // Qoida: qaytarilgan kundan boshlab pul olinmaydi → o'sha kun allaqachon kamaygan
    returnedSoFar += returnsByDay.get(key) || 0;
    const quantity = Math.max(item.quantity - returnedSoFar, 0);
    const dailyAmount = quantity * item.dailyRate;
    cumulative += dailyAmount;

    rows.push({ date: key, dayNumber, quantity, dailyAmount, cumulativeAmount: cumulative });

    cursor = addTzDays(cursor, 1);
    dayNumber++;
  }

  return rows;
}

/**
 * Segmentlarni kunlik jadvaldan hosil qiladi: bir xil miqdorda o'tgan
 * ketma-ket kunlar bitta segmentga birlashtiriladi.
 * Kafolat: sum(segment.amount) === jadvalning oxirgi cumulativeAmount.
 */
export function segmentsFromSchedule(schedule: DailyRow[], dailyRate: number): Segment[] {
  const segments: Segment[] = [];
  let run: DailyRow[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const quantity = run[0].quantity;
    // Miqdori 0 bo'lgan oraliqlar chekda ko'rsatilmaydi (summaga ta'sir qilmaydi)
    if (quantity === 0) {
      run = [];
      return;
    }
    segments.push({
      from: run[0].date,
      to: run[run.length - 1].date,
      quantity,
      days: run.length,
      amount: quantity * dailyRate * run.length,
    });
    run = [];
  };

  for (const row of schedule) {
    if (run.length > 0 && run[0].quantity !== row.quantity) flush();
    run.push(row);
  }
  flush();

  return segments;
}

/** Arendaning to'liq hisob-kitobi — chek, PDF va qarz hisoblash uchun. */
export function calculateRental(rental: RentalLike): RentalCalc {
  const checkDate = resolveCheckDate(rental);
  const startDay = startOfTzDay(rental.startDate);

  const schedules = rental.items.map((item) => buildItemSchedule(item, rental.startDate, checkDate));

  const items: ItemCalc[] = rental.items.map((item, idx) => {
    const schedule = schedules[idx];
    const itemTotal = schedule.length > 0 ? schedule[schedule.length - 1].cumulativeAmount : 0;
    return {
      equipment: item.equipment?.toString(),
      equipmentName: item.equipmentName,
      equipmentCategory: item.equipmentCategory,
      quantity: item.quantity,
      returnedQuantity: item.returnedQuantity,
      activeQuantity: item.quantity - item.returnedQuantity,
      dailyRate: item.dailyRate,
      days: schedule.length,
      segments: segmentsFromSchedule(schedule, item.dailyRate),
      itemTotal,
    };
  });

  // Umumiy kunlik jadval — barcha jihozlar bo'yicha kun-kunga yig'indi
  const days = schedules.reduce((max, s) => Math.max(max, s.length), 0);
  const dailySchedule: RentalCalc["dailySchedule"] = [];
  let cumulative = 0;
  for (let i = 0; i < days; i++) {
    const dailyAmount = schedules.reduce((sum, s) => sum + (s[i]?.dailyAmount || 0), 0);
    cumulative += dailyAmount;
    dailySchedule.push({
      date: tzDateKey(addTzDays(startDay, i)),
      dayNumber: i + 1,
      dailyAmount,
      cumulativeAmount: cumulative,
    });
  }

  const totalAmount = items.reduce((sum, i) => sum + i.itemTotal, 0);
  const balance = totalAmount - rental.depositAmount - rental.paidAmount;

  return {
    startDate: rental.startDate,
    checkDate,
    days,
    items,
    dailySchedule,
    totalAmount,
    depositAmount: rental.depositAmount,
    paidAmount: rental.paidAmount,
    debt: balance > 0 ? balance : 0,
    overpaid: balance < 0 ? -balance : 0,
  };
}

/**
 * Hujjatlar (nakladnoy, shartnoma) uchun kun soni. Chek bilan bir xil qoida:
 * ikki chegara ichiga olinadi.
 */
export function documentDayCount(from: Date, to: Date): number {
  return Math.max(inclusiveTzDayCount(from, to), 1);
}
