import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const completionStatusSchema = z.enum([
  "completed",
  "missed",
  "skipped",
]);
export type CompletionStatus = z.infer<typeof completionStatusSchema>;

export const goalStatusSchema = z.enum(["active", "achieved", "cancelled"]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const dayOfWeekSchema = z.number().int().min(0).max(6);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

export const iconColorSchema = z.enum([
  "blue",
  "emerald",
  "purple",
  "orange",
  "pink",
  "amber",
  "teal",
  "rose",
]);
export type IconColor = z.infer<typeof iconColorSchema>;

// =============================================================================
// REWARD CHART
// =============================================================================

export const createRewardChartSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
});

export type CreateRewardChartInput = z.infer<typeof createRewardChartSchema>;

// =============================================================================
// TASKS
// =============================================================================

export const createRewardChartTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  icon: z.string().min(1, "Icon is required"),
  iconColor: iconColorSchema,
  starValue: z.number().int().min(1).max(10).default(1),
  daysOfWeek: z.array(dayOfWeekSchema).min(1, "At least one day required"),
  sortOrder: z.number().int().default(0),
});

export type CreateRewardChartTaskInput = z.infer<
  typeof createRewardChartTaskSchema
>;

export const updateRewardChartTaskSchema = createRewardChartTaskSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export type UpdateRewardChartTaskInput = z.infer<
  typeof updateRewardChartTaskSchema
>;

// =============================================================================
// COMPLETIONS
// =============================================================================

export const createCompletionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

export type CreateCompletionInput = z.infer<typeof createCompletionSchema>;

// =============================================================================
// GOALS
// =============================================================================

export const createRewardChartGoalSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().min(1, "Emoji is required"),
  starTarget: z.number().int().min(1, "Target must be at least 1").max(1000),
});

export type CreateRewardChartGoalInput = z.infer<
  typeof createRewardChartGoalSchema
>;

export const updateRewardChartGoalSchema = createRewardChartGoalSchema
  .partial()
  .extend({
    status: goalStatusSchema.optional(),
  });

export type UpdateRewardChartGoalInput = z.infer<
  typeof updateRewardChartGoalSchema
>;

// =============================================================================
// MESSAGES
// =============================================================================

export const createRewardChartMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message is required")
    .max(500, "Message too long"),
});

export type CreateRewardChartMessageInput = z.infer<
  typeof createRewardChartMessageSchema
>;
