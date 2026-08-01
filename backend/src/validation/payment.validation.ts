import { z } from "zod";

export const createPaymentSchema = z.object({
  rentalId: z.string().length(24),
  amount: z.number().int().min(1),
  method: z.enum(["cash", "card", "transfer"]),
  note: z.string().max(200).optional(),
});

export const deletePaymentSchema = z.object({
  id: z.string().length(24),
});
