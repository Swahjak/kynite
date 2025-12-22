import { z } from "zod";

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
    color: eventColorSchema.nullable().optional(),
    googleCalendarId: z.string().nullable().optional(),
    participantIds: z
      .array(z.string())
      .min(1, "At least one participant required"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateEventSchema = createEventSchema
  .partial()
  .extend({
    id: z.string(),
  })
  .refine(
    (data) => {
      // Only validate if both are provided
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
  colors: z.array(eventColorSchema).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
