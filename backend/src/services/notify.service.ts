import { User } from "../models/User";
import { env } from "../config/env";

let botInstance: any = null;

export function setBotInstance(bot: any) {
  botInstance = bot;
}

async function getAdminChatIds(): Promise<number[]> {
  const admins = await User.find({ role: "ADMIN", isActive: true }).select("telegramId");
  return admins.map((a) => a.telegramId).filter((id): id is number => !!id);
}

async function sendMessage(chatId: number, text: string) {
  if (!botInstance) return;
  try {
    await botInstance.api.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error(`Failed to send message to ${chatId}:`, err);
  }
}

export const notifyService = {
  async rentalCreated(rental: any) {
    const adminIds = await getAdminChatIds();
    const clientDoc = rental.client as any;
    const itemsList = rental.items
      .map((item: any) => `  ${item.quantity}x ${item.equipmentName}`)
      .join("\n");

    const text = [
      `🆕 <b>Yangi arenda: ${rental.rentalNumber}</b>`,
      `Mijoz: ${clientDoc.fullName || clientDoc.name}`,
      `Jihozlar:\n${itemsList}`,
      `Boshlanish: ${new Date(rental.startDate).toLocaleDateString("uz-UZ")}`,
      rental.expectedEndDate
        ? `Tugash: ${new Date(rental.expectedEndDate).toLocaleDateString("uz-UZ")}`
        : "",
      rental.depositAmount ? `Omonat: ${rental.depositAmount.toLocaleString("uz-UZ")} so'm` : "",
    ]
      .filter(Boolean)
      .join("\n");

    for (const chatId of adminIds) {
      await sendMessage(chatId, text);
    }
  },

  async rentalClosed(rental: any, finalCheck: any) {
    const adminIds = await getAdminChatIds();
    const text = [
      `✅ <b>Arenda yopildi: ${rental.rentalNumber}</b>`,
      `Umumiy: ${finalCheck.totalAmount.toLocaleString("uz-UZ")} so'm`,
      `To'lov: ${finalCheck.paidAmount.toLocaleString("uz-UZ")} so'm`,
      `Qarz: ${finalCheck.debt.toLocaleString("uz-UZ")} so'm`,
    ].join("\n");

    for (const chatId of adminIds) {
      await sendMessage(chatId, text);
    }
  },

  async paymentReceived(payment: any, rentalNumber: string) {
    const adminIds = await getAdminChatIds();
    const methodMap: Record<string, string> = { cash: "Naqd", card: "Karta", transfer: "O'tkazma" };
    const text = [
      `💰 <b>To'lov: ${payment.amount.toLocaleString("uz-UZ")} so'm</b>`,
      `Arenda: ${rentalNumber}`,
      `Usul: ${methodMap[payment.method] || payment.method}`,
      payment.note ? `Eslatma: ${payment.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    for (const chatId of adminIds) {
      await sendMessage(chatId, text);
    }
  },

  async overdueAlert(rental: any, overdueDays: number) {
    const adminIds = await getAdminChatIds();
    const clientDoc = rental.client as any;
    const text = [
      `⚠️ <b>Muddati o'tdi: ${rental.rentalNumber}</b>`,
      `${overdueDays} kun o'tdi`,
      `Mijoz: ${clientDoc.fullName || clientDoc.name} (${clientDoc.phone})`,
      rental.expectedEndDate
        ? `Kutilgan: ${new Date(rental.expectedEndDate).toLocaleDateString("uz-UZ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    for (const chatId of adminIds) {
      await sendMessage(chatId, text);
    }
  },
};
