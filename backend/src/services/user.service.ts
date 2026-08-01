import { User } from "../models/User";
import { Rental } from "../models/Rental";
import { Payment } from "../models/Payment";
import { AuditLog } from "../models/AuditLog";
import { AppError } from "../utils/AppError";
import {
  CreateUserDTO,
  UpdateUserDTO,
  GetUsersFilters,
  AuditFilters,
} from "../types/user.type";

export const UserService = {
  async getAll(filters: GetUsersFilters) {
    const query: Record<string, unknown> = {};

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }
    if (filters.role !== undefined) {
      query.role = filters.role;
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    return users;
  },

  async create(dto: CreateUserDTO) {
    const existing = await User.findOne({ telegramId: dto.telegramId });
    if (existing) {
      throw new AppError("Bu Telegram ID allaqachon band", 409, "DUPLICATE_TELEGRAM_ID");
    }

    const user = await User.create({
      telegramId: dto.telegramId,
      name: dto.name,
      username: dto.username ?? "",
      role: dto.role,
      isActive: true,
    });

    return user;
  },

  async getById(id: string) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Foydalanuvchi topilmadi", 404, "NOT_FOUND");
    }

    const [totalRentalsCreated, totalPaymentsAdded, lastAudit] = await Promise.all([
      Rental.countDocuments({ createdBy: id }),
      Payment.countDocuments({ createdBy: id }),
      AuditLog.findOne({ userId: id }).sort({ createdAt: -1 }).select("createdAt").lean(),
    ]);

    return {
      ...user.toObject(),
      stats: {
        totalRentalsCreated,
        totalPaymentsAdded,
        lastActivity: (lastAudit as any)?.createdAt ?? null,
      },
    };
  },

  async update(id: string, dto: UpdateUserDTO) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Foydalanuvchi topilmadi", 404, "NOT_FOUND");
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    await user.save();
    return user;
  },

  async updateSelf(userId: string, dto: { name?: string }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("Foydalanuvchi topilmadi", 404, "NOT_FOUND");
    }

    if (dto.name !== undefined) user.name = dto.name;

    await user.save();
    return user;
  },

  async getAudit(id: string, filters: AuditFilters) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError("Foydalanuvchi topilmadi", 404, "NOT_FOUND");
    }

    const query: Record<string, unknown> = { userId: id };
    if (filters.action) query.action = filters.action;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) (query.createdAt as any).$gte = new Date(filters.from);
      if (filters.to) (query.createdAt as any).$lte = new Date(filters.to);
    }

    const skip = ((filters.page || 1) - 1) * (filters.limit || 20);
    const limit = filters.limit || 20;

    const [data, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(query),
    ]);

    return {
      data,
      total,
      page: filters.page,
      totalPages: Math.ceil(total / limit),
    };
  },
};
