import cron from "node-cron";
import { Rental } from "../models/Rental";
import { Debt } from "../models/Debt";
import { AuditLog } from "../models/AuditLog";
import { notifyService } from "../services/notify.service";
import { syncDebtStatus } from "../services/debt-status.service";
import { APP_TZ, addTzDays, inclusiveTzDayCount, startOfTzDay, tzDateKey } from "../utils/date";

export function startOverdueCheckJob() {
  // Har kuni 09:00 da — biznes vaqt mintaqasi bo'yicha.
  // Ilgari "0 4 * * *" qo'lda UTC'ga o'tkazilgan edi; endi mintaqa
  // node-cron'ga berilib, server TZ'i o'zgarsa ham vaqt siljimaydi.
  cron.schedule(
    "0 9 * * *",
    async () => {
      console.log("[Cron] Overdue check started...");

      try {
        const today = startOfTzDay(new Date());

        const overdueRentals = await Rental.find({
          status: "active",
          expectedEndDate: { $lt: today },
        }).populate("client", "fullName phone telegramId");

        for (const rental of overdueRentals) {
          try {
            rental.status = "overdue";
            await rental.save();

            await AuditLog.create({
              userId: rental.createdBy,
              action: "rental.overdue",
              resourceType: "rental",
              resourceId: rental._id,
              resourceName: rental.rentalNumber,
              after: { status: "overdue" },
            });

            const overdueDays = Math.max(
              inclusiveTzDayCount(rental.expectedEndDate!, today) - 1,
              0,
            );
            await notifyService.overdueAlert(rental, overdueDays);
          } catch (rentalError) {
            console.error(`[Cron] Failed to process rental ${rental.rentalNumber}:`, rentalError);
          }
        }

        console.log(
          `[Cron] Overdue check completed. ${overdueRentals.length} rentals marked as overdue.`,
        );

        await checkDebtDueDates();
      } catch (error) {
        console.error("[Cron] Overdue check error:", error);
      }
    },
    { timezone: APP_TZ },
  );

  console.log(`[Cron] Overdue check job scheduled (daily at 09:00 ${APP_TZ})`);
}

/**
 * QARZ MUDDATLARI — arenda muddati bilan BIR XIL jadvalda (09:00, APP_TZ)
 * tekshiriladi. Ikkinchi `cron.schedule` ochmadik: mintaqa bitta joyda
 * turgani ma'qul.
 *
 * Ikki holat:
 *  1. Muddatga 2 kun qolgan — eslatma (overview.md, 4-jarayon).
 *  2. Muddat o'tgan — hujjat `overdue` ga o'tadi va xabar yuboriladi.
 *
 * Eslatma har kuni takrorlanmasligi uchun AYNAN `dueDate - 2 kun` sanasida
 * yuboriladi (kun kaliti bo'yicha solishtiriladi) — buning uchun modelga
 * qo'shimcha maydon kerak emas.
 */
async function checkDebtDueDates() {
  const today = startOfTzDay(new Date());
  const reminderKey = tzDateKey(addTzDays(today, 2));

  const debts = await Debt.find({
    status: { $in: ["pending", "overdue"] },
    dueDate: { $exists: true, $ne: null },
  })
    .populate("client", "fullName phone telegramId")
    .populate("rental", "rentalNumber");

  let reminded = 0;
  let markedOverdue = 0;

  for (const debt of debts) {
    try {
      // Arenda allaqachon to'langan bo'lsa hujjat yopiladi — eslatma ketmaydi.
      // `rental` bu yerda populate qilingan hujjat, shuning uchun ID ajratiladi.
      const rentalDoc = debt.rental as any;
      await syncDebtStatus(rentalDoc?._id ?? rentalDoc);
      const fresh = await Debt.findById(debt._id).select("status");
      if (!fresh || fresh.status === "paid") continue;

      const dueKey = tzDateKey(debt.dueDate!);

      if (dueKey === reminderKey && debt.status === "pending") {
        await notifyService.debtReminder(debt, debt.rental, debt.client, "due_soon", 2);
        reminded++;
        continue;
      }

      if (startOfTzDay(debt.dueDate!) < today) {
        const overdueDays = Math.max(inclusiveTzDayCount(debt.dueDate!, today) - 1, 0);
        // Xabar faqat holat ENDI o'zgarganda yuboriladi — har kuni emas
        if (debt.status !== "overdue") {
          await Debt.updateOne({ _id: debt._id }, { $set: { status: "overdue" } });
          markedOverdue++;
          await notifyService.debtReminder(debt, debt.rental, debt.client, "overdue", overdueDays);
        }
      }
    } catch (err) {
      console.error(`[Cron] Debt ${debt._id} tekshirilmadi:`, err);
    }
  }

  console.log(
    `[Cron] Debt check completed. ${reminded} reminder, ${markedOverdue} marked as overdue.`,
  );
}
