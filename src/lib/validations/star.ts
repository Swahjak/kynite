import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const starTransactionTypeSchema = z.enum([
  "reward_chart",
  "chore",
  "bonus",
  "redemption",
]);
export type StarTransactionType = z.infer<typeof starTransactionTypeSchema>;

// =============================================================================
// ADD STARS
// =============================================================================

export const addStarsSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  amount: z.number().int().min(1, "Amount must be at least 1"),
  type: z.enum(["reward_chart", "chore", "bonus"]),
  referenceId: z.string().optional(),
  description: z.string().min(1, "Description is required").max(200),
  awardedById: z.string().optional(),
});

export type AddStarsInput = z.infer<typeof addStarsSchema>;

// =============================================================================
// REMOVE STARS
// =============================================================================

export const removeStarsSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  amount: z.number().int().min(1, "Amount must be at least 1"),
  type: z.literal("redemption"),
  referenceId: z.string().min(1, "Reference ID is required"),
  description: z.string().min(1, "Description is required").max(200),
});

export type RemoveStarsInput = z.infer<typeof removeStarsSchema>;

// =============================================================================
// HISTORY QUERY
// =============================================================================

export const starHistoryQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  type: starTransactionTypeSchema.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type StarHistoryQueryInput = z.infer<typeof starHistoryQuerySchema>;

// =============================================================================
// BONUS STARS (API input)
// =============================================================================

export const grantBonusStarsSchema = z.object({
  amount: z.number().int().min(1).max(100, "Max 100 stars per bonus"),
  description: z.string().min(1, "Reason is required").max(200),
});

export type GrantBonusStarsInput = z.infer<typeof grantBonusStarsSchema>;
