import { z } from "zod";

export const createClientSchema = z.object({
  fullName: z.string().min(2, "Kamida 2 belgi").max(100).trim(),
  phone: z.string().regex(/^\+998\d{9}$/, "Format: +998901234567"),
  address: z.string().max(200).optional().or(z.literal("")),
  note: z.string().max(500).optional().or(z.literal("")),
});

export type CreateClientFormData = z.infer<typeof createClientSchema>;

export const createRentalSchema = z.object({
  clientId: z.string().min(1, "Mijozni tanlang"),
  startDate: z.string().min(1, "Boshlanish sanasini kiriting"),
  expectedEndDate: z.string().optional().or(z.literal("")),
  depositAmount: z.coerce.number().min(0).default(0),
  note: z.string().max(500).optional().or(z.literal("")),
  deliveryLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().max(200).optional(),
    })
    .optional(),
});

export type CreateRentalFormData = z.infer<typeof createRentalSchema>;

export type CreateRentalFormInput = z.input<typeof createRentalSchema>;

export const createPaymentSchema = z.object({
  rentalId: z.string().min(1, "Arendani tanlang"),
  amount: z.coerce.number().min(1, "Kamida 1 so'm"),
  method: z.enum(["cash", "card", "transfer"]),
  note: z.string().optional().or(z.literal("")),
});

export type CreatePaymentFormData = z.infer<typeof createPaymentSchema>;
