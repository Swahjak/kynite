import { z } from "zod";

// =============================================================================
// Enums
// =============================================================================

export const choreStatusSchema = z.enum(["pending", "completed", "skipped"]);
export const choreRecurrenceSchema = z.enum([
  "once",
  "daily",
  "weekly",
  "weekdays",
  "weekends",
  "monthly",
]);

// =============================================================================
// Input Schemas
// =============================================================================

export const createChoreSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).nullable().optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").nullable().optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:mm)").nullable().optional(),
  recurrence: choreRecurrenceSchema.default("once"),
  isUrgent: z.boolean().default(false),
  starReward: z.number().int().min(0).max(1000).default(10),
});

export const updateChoreSchema = createChoreSchema.partial();

export const choreQuerySchema = z.object({
  status: choreStatusSchema.optional(),
  assignedToIds: z.array(z.string()).optional(),
  isUrgent: z.coerce.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const completeChoreSchema = z.object({
  completedById: z.string().min(1, "Completer ID is required"),
});

// =============================================================================
// Type Exports
// =============================================================================

export type CreateChoreInput = z.infer<typeof createChoreSchema>;
export type UpdateChoreInput = z.infer<typeof updateChoreSchema>;
export type ChoreQueryInput = z.infer<typeof choreQuerySchema>;
export type CompleteChoreInput = z.infer<typeof completeChoreSchema>;
