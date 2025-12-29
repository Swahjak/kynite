import { z } from "zod";

export const recurrenceFrequencySchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

export const recurrenceEndTypeSchema = z.enum(["never", "count", "date"]);

export const recurrenceSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    interval: z.number().int().min(1).max(99).default(1),
    endType: recurrenceEndTypeSchema,
    endCount: z.number().int().min(1).max(365).optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.endType === "count" && !data.endCount) return false;
      if (data.endType === "date" && !data.endDate) return false;
      return true;
    },
    {
      message: "End count or date required based on end type",
      path: ["endCount"],
    }
  );

export type RecurrenceInput = z.infer<typeof recurrenceSchema>;
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;
export type RecurrenceEndType = z.infer<typeof recurrenceEndTypeSchema>;
