import { z } from "zod";
import { CATEGORIES, EVENT_TYPES } from "@/components/calendar/types";

export const eventCategorySchema = z.enum(CATEGORIES as [string, ...string[]], {
  message: "Category is required",
});

export const eventTypeSchema = z.enum(EVENT_TYPES as [string, ...string[]], {
  message: "Event type is required",
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
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type TEventFormData = z.infer<typeof eventSchema>;
