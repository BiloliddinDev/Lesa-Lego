import cron from "node-cron";
import { Rental } from "../models/Rental";
import { AuditLog } from "../models/AuditLog";
import { notifyService } from "../services/notify.service";

export function startOverdueCheckJob() {
  // Har kuni 09:00 da ishlaydi (Toshkent vaqti UTC+5 → 04:00 UTC)
  cron.schedule("0 4 * * *", async () => {
    console.log("[Cron] Overdue check started...");

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

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

          const expectedEnd = new Date(rental.expectedEndDate!);
          const diffTime = today.getTime() - expectedEnd.getTime();
          const overdueDays = Math.ceil(diffTime / 86400000);
          await notifyService.overdueAlert(rental, overdueDays);
        } catch (rentalError) {
          console.error(`[Cron] Failed to process rental ${rental.rentalNumber}:`, rentalError);
        }
      }

      console.log(`[Cron] Overdue check completed. ${overdueRentals.length} rentals marked as overdue.`);
    } catch (error) {
      console.error("[Cron] Overdue check error:", error);
    }
  });

  console.log("[Cron] Overdue check job scheduled (daily at 09:00)");
}
