import { ICategory } from "../models/Category";
import { Category } from "../models/Category";
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
    
    // Check if it has equipment (simplified for now, ideally use a count)
    // In a real app, we'd check if any equipment belongs to this category
    // For this implementation, we'll let it be handled by the DB if there's a ref constraint, 
    // but here we'll just perform a soft delete.
    
    category.isActive = false;
    await category.save();
    return { message: "Kategoriya o'chirildi" };
  }
}

export const categoryService = new CategoryService();
