import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { env } from "../config/env";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Biznes vaqt mintaqasi. Barcha kunlik hisob-kitoblar (arenda kunlari, hisobot
 * kunlari, cron) shu mintaqadagi kun chegaralari bo'yicha ishlaydi — serverning
 * o'z TZ'iga bog'liq emas.
 */
export const APP_TZ = env.APP_TZ;

/** Berilgan vaqt shu mintaqada qaysi kunga tushadi: "YYYY-MM-DD" */
export function tzDateKey(date: Date | string): string {
  return dayjs(date).tz(APP_TZ).format("YYYY-MM-DD");
}

/** Shu mintaqadagi kun boshi (00:00) ning aniq vaqt momenti */
export function startOfTzDay(date: Date | string): Date {
  return dayjs(date).tz(APP_TZ).startOf("day").toDate();
}

/** Shu mintaqadagi kun oxiri (23:59:59.999) ning aniq vaqt momenti */
export function endOfTzDay(date: Date | string): Date {
  return dayjs(date).tz(APP_TZ).endOf("day").toDate();
}

/** "YYYY-MM-DD" kalitini shu mintaqadagi kun boshiga aylantiradi */
export function tzDayStartFromKey(key: string): Date {
  return dayjs.tz(key, APP_TZ).startOf("day").toDate();
}

/** Kunlar qo'shish (mintaqa kun chegaralarini saqlab) */
export function addTzDays(date: Date | string, days: number): Date {
  return dayjs(date).tz(APP_TZ).add(days, "day").toDate();
}

/**
 * Ikki sana orasidagi kunlar soni, ikki chegara ham ichiga olinadi.
 * 01.09 → 01.09 = 1 kun, 01.09 → 05.09 = 5 kun.
 */
export function inclusiveTzDayCount(from: Date | string, to: Date | string): number {
  const a = dayjs(from).tz(APP_TZ).startOf("day");
  const b = dayjs(to).tz(APP_TZ).startOf("day");
  return Math.max(b.diff(a, "day") + 1, 0);
}

/** Oy chegaralari: [birinchi kun 00:00, oxirgi kun 23:59:59.999] — mintaqa bo'yicha */
export function tzMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = dayjs.tz(`${year}-${String(month).padStart(2, "0")}-01`, APP_TZ).startOf("month");
  return { start: start.toDate(), end: start.endOf("month").toDate() };
}

/** Shu mintaqadagi bugungi kun boshi */
export function tzToday(): Date {
  return startOfTzDay(new Date());
}
