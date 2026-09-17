import { ICategory } from "../models/Category";
import { Category } from "../models/Category";
import { Equipment } from "../models/Equipment";
import { AppError } from "../utils/AppError";

export class CategoryService {
  async getAllCategories() {
    return await Category.find().sort({ order: 1 });
  }

  async getCategoryById(id: string) {
    const category = await Category.findById(id);
    if (!category) {
      throw new AppError("Kategoriya topilmadi", 404);
    }
    return category;
  }

  async createCategory(data: Partial<ICategory>) {
    // Check if name already exists
    const existing = await Category.findOne({ name: data.name });
    if (existing) {
      throw new AppError("Bu nomli kategoriya allaqachon mavjud", 409);
    }
    const category = new Category(data);
    await category.save();
    return category;
  }

  async updateCategory(id: string, data: Partial<ICategory>) {
    const category = await this.getCategoryById(id);
    
    if (data.name) {
      const existing = await Category.findOne({ name: data.name, _id: { $ne: id } });
      if (existing) {
        throw new AppError("Bu nomli kategoriya allaqachon mavjud", 409);
      }
    }

    Object.assign(category, data);
    await category.save();
    return category;
  }

  async deleteCategory(id: string) {
    const category = await this.getCategoryById(id);

    // Faol jihozi bor kategoriyani o'chirib bo'lmaydi: ilgari tekshiruv yo'q
    // edi va jihozlar "egasiz" qolib, ro'yxatlarda kategoriyasiz ko'rinardi.
    const activeEquipment = await Equipment.countDocuments({ category: id, isActive: true });
    if (activeEquipment > 0) {
      throw new AppError(
        `Bu kategoriyada ${activeEquipment} ta faol jihoz bor. Avval ularni ko'chiring yoki o'chiring`,
        400,
        "CATEGORY_NOT_EMPTY",
      );
    }

    category.isActive = false;
    await category.save();
    return { message: "Kategoriya o'chirildi" };
  }
}

export const categoryService = new CategoryService();
