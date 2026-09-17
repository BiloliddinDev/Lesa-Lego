import { IClient } from "../models/Client";
import { Client } from "../models/Client";
import { AppError } from "../utils/AppError";
import { escapeRegex } from "../utils/regex";

export class ClientService {
  async getAllClients(filters: { search?: string; hasDebt?: boolean; isActive?: boolean; page?: number; limit?: number }) {
    const query: any = {};
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.hasDebt) query.totalDebt = { $gt: 0 };
    if (filters.search) {
      const term = escapeRegex(filters.search);
      query.$or = [
        { fullName: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
      ];
    }

    const skip = ((filters.page || 1) - 1) * (filters.limit || 20);
    const limit = filters.limit || 20;

    const [clients, total] = await Promise.all([
      Client.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Client.countDocuments(query),
    ]);

    return {
      clients,
      total,
      page: filters.page || 1,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getClientById(id: string) {
    const client = await Client.findById(id).populate("createdBy", "name");
    if (!client) {
      throw new AppError("Mijoz topilmadi", 404);
    }
    return client;
  }

  async createClient(data: any) {
    // DIQQAT: `{ telegramId: undefined }` ni Mongoose BO'SH shartga ({}) aylantiradi,
    // u esa `$or` ichida HAR QANDAY hujjatga mos keladi. Ilgari shu sabab
    // Telegram ID siz ikkinchi mijozni yaratib bo'lmasdi — har safar 409
    // "allaqachon mavjud" chiqardi. Shuning uchun shartlar shartli quriladi.
    const conditions: Record<string, unknown>[] = [{ phone: data.phone }];
    if (data.telegramId !== undefined && data.telegramId !== null) {
      conditions.push({ telegramId: data.telegramId });
    }

    const existing = await Client.findOne({ $or: conditions });
    if (existing) {
      throw new AppError(
        existing.phone === data.phone
          ? "Bu telefon raqami allaqachon mavjud"
          : "Bu Telegram ID allaqachon mavjud",
        409,
      );
    }

    const client = new Client(data);
    await client.save();
    return client;
  }

  async updateClient(id: string, data: any) {
    const client = await this.getClientById(id);
    
    if (data.phone) {
      const existing = await Client.findOne({ phone: data.phone, _id: { $ne: id } });
      if (existing) {
        throw new AppError("Bu telefon raqami allaqachon band", 409);
      }
    }

    if (data.telegramId !== undefined && data.telegramId !== null) {
      const existing = await Client.findOne({ telegramId: data.telegramId, _id: { $ne: id } });
      if (existing) {
        throw new AppError("Bu Telegram ID allaqachon band", 409);
      }
    }

    Object.assign(client, data);
    await client.save();
    return client;
  }

  async deleteClient(id: string) {
    const client = await this.getClientById(id);
    client.isActive = false;
    await client.save();
    return { message: "Mijoz o'chirildi (soft delete)" };
  }
}

export const clientService = new ClientService();
