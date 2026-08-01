import { z } from "zod";

export const createEquipmentSchema = z.object({
  categoryId: z.string().length(24),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(300).optional(),
  totalQuantity: z.number().int().min(1),
  dailyRate: z.number().int().min(0),
});

export const updateEquipmentSchema = createEquipmentSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const adjustQuantitySchema = z.object({
  adjustment: z.number().int().refine((n) => n !== 0, {
    message: "Nol bo'lishi mumkin emas",
  }),
  reason: z.string().min(3).max(200),
});

export const deleteEquipmentSchema = z.object({
  id: z.string().length(24),
});
