import { z } from "zod";

export const getReportsSummarySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().optional(),
});

export const getReportsMonthlySchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
});
