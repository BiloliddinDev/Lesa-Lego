import { z } from "zod";

export const createUserSchema = z.object({
  telegramId: z.number().int().positive("telegramId musbat son bo'lsin"),
  name: z.string().min(2, "Ism kamida 2 belgi").max(100).trim(),
  username: z.string().trim().optional(),
  role: z.literal("WORKER"),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  isActive: z.boolean().optional(),
});

export const updateSelfSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
});

export const getUsersQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  role: z.enum(["ADMIN", "WORKER"]).optional(),
});

export const auditFilterSchema = z.object({
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
