import { z } from "zod";
import { recurrenceSchema } from "./recurrence";

export const eventCategorySchema = z.enum([
  "sports",
  "work",
  "school",
  "family",
  "social",
  "home",
]);

export const eventTypeSchema = z.enum([
  "event",
  "birthday",
  "appointment",
  "task",
  "reminder",
]);

// Keep for backward compatibility during migration
export const eventColorSchema = z.enum([
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
]);

export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(500).nullable().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    allDay: z.boolean().default(false),
    category: eventCategorySchema.default("family"),
    eventType: eventTypeSchema.default("event"),
    isCompleted: z.boolean().default(false),
    color: eventColorSchema.nullable().optional(), // Deprecated, keep for migration
    googleCalendarId: z.string().nullable().optional(),
    participantIds: z
      .array(z.string())
      .min(1, "At least one participant required"),
    ownerId: z.string().optional(), // First participant is owner if not specified
    // Recurrence support
    recurrence: recurrenceSchema.nullable().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

// Edit scope enum for recurring events
export const editScopeSchema = z.enum(["this", "all"]);
export type EditScope = z.infer<typeof editScopeSchema>;

export const updateEventSchema = createEventSchema
  .partial()
  .extend({
    id: z.string(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return data.endTime > data.startTime;
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  );

export const eventQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  participantIds: z.array(z.string()).optional(),
  categories: z.array(eventCategorySchema).optional(),
  eventTypes: z.array(eventTypeSchema).optional(),
  colors: z.array(eventColorSchema).optional(), // Deprecated
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
