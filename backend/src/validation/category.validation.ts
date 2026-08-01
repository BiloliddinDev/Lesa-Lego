import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50).trim(),
  description: z.string().max(200).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const deleteCategorySchema = z.object({
  id: z.string().length(24),
});
