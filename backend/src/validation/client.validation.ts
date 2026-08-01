import { z } from "zod";

export const createClientSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  phone: z.string().regex(/^\+998\d{9}$/, "Format: +998901234567"),
  telegramId: z.number().int().positive().optional(),
  address: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  telegramId: z.number().int().positive().nullable().optional(),
});

export const clientSearchSchema = z.object({
  search: z.string().optional(),
  hasDebt: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
