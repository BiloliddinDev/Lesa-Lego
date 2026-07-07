import { User } from "../models/User";
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
      throw new AppError(
        "DUPLICATE_TELEGRAM_ID",
        "Bu Telegram ID allaqachon band",
        409,
      );
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
      throw new AppError("NOT_FOUND", "Foydalanuvchi topilmadi", 404);
    }

    return {
      ...user.toObject(),
      stats: {
        totalRentalsCreated: 0,
        totalPaymentsAdded: 0,
        lastActivity: null,
      },
    };
  },

  async update(id: string, dto: UpdateUserDTO) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError("NOT_FOUND", "Foydalanuvchi topilmadi", 404);
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    await user.save();
    return user;
  },

  async updateSelf(userId: string, dto: { name?: string }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("NOT_FOUND", "Foydalanuvchi topilmadi", 404);
    }

    if (dto.name !== undefined) user.name = dto.name;

    await user.save();
    return user;
  },

  async getAudit(id: string, filters: AuditFilters) {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError("NOT_FOUND", "Foydalanuvchi topilmadi", 404);
    }

    return {
      data: [],
      total: 0,
      page: filters.page,
      totalPages: 0,
    };
  },
};
