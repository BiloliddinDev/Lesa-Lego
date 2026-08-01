import { IEquipment } from "../models/Equipment";
import { Equipment } from "../models/Equipment";
import { AuditLog } from "../models/AuditLog";
import { categoryService } from "../services/category.service";
import { AppError } from "../utils/AppError";
import mongoose from "mongoose";

export class EquipmentService {
  async getAllEquipment(filters: { categoryId?: string; isActive?: boolean; available?: boolean; search?: string }) {
    const query: any = {};
    if (filters.categoryId) query.category = filters.categoryId;
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.available) {
      query.$expr = { $gt: ["$totalQuantity", "$rentedQuantity"] };
    }
    if (filters.search) {
      query.name = { $regex: filters.search, $options: "i" };
    }

    return await Equipment.find(query).populate("category", "name");
  }

  async getEquipmentById(id: string) {
    const equipment = await Equipment.findById(id).populate("category", "name");
    if (!equipment) {
      throw new AppError("Jihoz topilmadi", 404);
    }
    return equipment;
  }

  async createEquipment(data: any) {
    const category = await categoryService.getCategoryById(data.categoryId);
    if (!category) {
      throw new AppError("Kategoriya topilmadi", 404);
    }

    const existing = await Equipment.findOne({ 
      category: data.categoryId, 
      name: data.name 
    });
    if (existing) {
      throw new AppError("Ushbu kategoriyada bunday nomli jihoz allaqachon bor", 409);
    }

    const equipment = new Equipment({
      ...data,
      category: data.categoryId
    });
    await equipment.save();
    return equipment;
  }

  async updateEquipment(id: string, data: any) {
    const equipment = await this.getEquipmentById(id);
    
    if (data.categoryId) {
      const category = await categoryService.getCategoryById(data.categoryId);
      if (!category) throw new AppError("Kategoriya topilmadi", 404);
      equipment.category = data.categoryId;
    }

    Object.assign(equipment, data);
    await equipment.save();
    return equipment;
  }

  async adjustQuantity(id: string, adjustment: number, reason: string, userId: string) {
    const equipment = await this.getEquipmentById(id);
    const newTotal = equipment.totalQuantity + adjustment;
    
    if (newTotal < equipment.rentedQuantity) {
      throw new AppError("Ombor miqdori band jihozlardan kam bo'lishi mumkin emas", 400);
    }

    equipment.totalQuantity = newTotal;
    await equipment.save();

    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(userId),
      userFullName: undefined,
      userRole: "ADMIN",
      action: "equipment.adjust_quantity",
      resourceType: "equipment",
      resourceId: new mongoose.Types.ObjectId(id),
      resourceName: equipment.name,
      after: { adjustment, reason, newTotal },
    });

    return equipment;
  }

  async deleteEquipment(id: string) {
    const equipment = await this.getEquipmentById(id);
    equipment.isActive = false;
    await equipment.save();
    return { message: "Jihoz o'chirildi (soft delete)" };
  }
}

export const equipmentService = new EquipmentService();
