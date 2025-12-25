import { z } from "zod";

export const addCalendarSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  googleCalendarId: z
    .string()
    .min(1, "Google Calendar ID is required")
    .max(255),
  name: z.string().min(1, "Name is required").max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  accessRole: z.enum(["owner", "writer", "reader"]).optional(),
});

export type AddCalendarInput = z.infer<typeof addCalendarSchema>;
