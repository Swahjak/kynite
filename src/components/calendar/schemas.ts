import { z } from "zod";
import { CATEGORIES, EVENT_TYPES } from "@/components/calendar/types";

export const eventCategorySchema = z.enum(CATEGORIES as [string, ...string[]], {
  message: "Category is required",
});

export const eventTypeSchema = z.enum(EVENT_TYPES as [string, ...string[]], {
  message: "Event type is required",
});

export const recurrenceFrequencySchema = z.enum([
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

export const recurrenceEndTypeSchema = z.enum(["never", "count", "date"]);

export const recurrenceFormSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().min(1).max(99),
  endType: recurrenceEndTypeSchema,
  endCount: z.number().int().min(1).max(365).optional(),
  endDate: z.date().optional(),
});

export const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.date({
      message: "Start date is required",
    }),
    endDate: z.date({
      message: "End date is required",
    }),
    category: eventCategorySchema,
    eventType: eventTypeSchema,
    allDay: z.boolean(),
    ownerId: z.string().min(1, "Owner is required"),
    participantIds: z.array(z.string()),
    recurrence: recurrenceFormSchema,
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      if (data.recurrence.frequency === "none") return true;
      if (data.recurrence.endType === "count" && !data.recurrence.endCount)
        return false;
      if (data.recurrence.endType === "date" && !data.recurrence.endDate)
        return false;
      return true;
    },
    {
      message: "End count or date required",
      path: ["recurrence", "endCount"],
    }
  );

export type TEventFormData = z.infer<typeof eventSchema>;
export type TRecurrenceFormData = z.infer<typeof recurrenceFormSchema>;
