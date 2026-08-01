import { z } from "zod";

export const createRentalSchema = z.object({
  clientId: z.string().length(24),
  items: z.array(
    z.object({
      equipmentId: z.string().length(24),
      quantity: z.number().int().min(1),
      dailyRate: z.number().int().min(0).optional(),
    })
  ).min(1, "Kamida 1 ta jihoz"),
  startDate: z.string().datetime(),
  expectedEndDate: z.string().datetime().optional(),
  depositAmount: z.number().int().min(0).default(0),
  note: z.string().max(500).optional(),
  deliveryLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().max(200).optional(),
    })
    .optional(),
});

export const returnItemsSchema = z.object({
  returns: z.array(
    z.object({
      equipmentId: z.string().length(24),
      quantity: z.number().int().min(1),
      note: z.string().max(200).optional(),
    })
  ).min(1),
  returnDate: z.string().datetime().optional(),
});

export const closeRentalSchema = z.object({
  endDate: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export const rentalFilterSchema = z.object({
  status: z.enum(["active", "overdue", "completed"]).optional(),
  clientId: z.string().length(24).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
