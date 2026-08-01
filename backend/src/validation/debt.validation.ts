import { z } from "zod";

export const createDebtSchema = z.object({
  clientId: z.string().length(24),
  rentalId: z.string().length(24),
  amount: z.number().int().min(1),
  dueDate: z.string().datetime().optional(),
  note: z.string().max(300).optional(),
});

export const payDebtSchema = z.object({
  amount: z.number().int().min(1),
  method: z.enum(["cash", "card", "transfer"]),
  note: z.string().max(200).optional(),
});
