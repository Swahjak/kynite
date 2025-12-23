import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const limitTypeSchema = z.enum([
  "none",
  "daily",
  "weekly",
  "monthly",
  "once",
]);
export type LimitType = z.infer<typeof limitTypeSchema>;

// =============================================================================
// REWARD CRUD
// =============================================================================

export const createRewardSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().min(1, "Emoji is required"),
  starCost: z.number().int().min(1, "Cost must be at least 1").max(100000),
  limitType: limitTypeSchema.default("none"),
});

export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = createRewardSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

// =============================================================================
// REDEMPTION
// =============================================================================

// No body needed - rewardId comes from URL path

// =============================================================================
// PRIMARY GOAL
// =============================================================================

export const setPrimaryGoalSchema = z.object({
  rewardId: z.string().min(1, "Reward ID is required"),
});

export type SetPrimaryGoalInput = z.infer<typeof setPrimaryGoalSchema>;

// =============================================================================
// QUERY PARAMS
// =============================================================================

export const rewardsQuerySchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});

export type RewardsQueryInput = z.infer<typeof rewardsQuerySchema>;

export const redemptionsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type RedemptionsQueryInput = z.infer<typeof redemptionsQuerySchema>;
