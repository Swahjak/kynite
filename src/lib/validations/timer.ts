import { z } from "zod";

// =============================================================================
// ENUMS
// =============================================================================

export const timerCategorySchema = z.enum(["screen", "chore", "activity"]);
export const timerControlModeSchema = z.enum(["parents_only", "anyone"]);
export const timerAlertModeSchema = z.enum([
  "none",
  "completion",
  "escalating",
]);
export const timerStatusSchema = z.enum([
  "running",
  "paused",
  "completed",
  "expired",
  "cancelled",
]);

export type TimerCategory = z.infer<typeof timerCategorySchema>;
export type TimerControlMode = z.infer<typeof timerControlModeSchema>;
export type TimerAlertMode = z.infer<typeof timerAlertModeSchema>;
export type TimerStatus = z.infer<typeof timerStatusSchema>;

// =============================================================================
// TEMPLATE SCHEMAS
// =============================================================================

export const createTimerTemplateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: timerCategorySchema.default("chore"),
  durationSeconds: z.number().int().min(30).max(86400), // 30s to 24h
  starReward: z.number().int().min(0).max(1000).default(0),
  controlMode: timerControlModeSchema.default("anyone"),
  alertMode: timerAlertModeSchema.default("completion"),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(), // up to 1h
  showAsQuickAction: z.boolean().default(false),
});

export const updateTimerTemplateSchema = createTimerTemplateSchema.partial();

export type CreateTimerTemplateInput = z.infer<
  typeof createTimerTemplateSchema
>;
export type UpdateTimerTemplateInput = z.infer<
  typeof updateTimerTemplateSchema
>;

// =============================================================================
// ACTIVE TIMER SCHEMAS
// =============================================================================

export const startTimerFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  assignedToId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const startOneOffTimerSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: timerCategorySchema.default("chore"),
  durationSeconds: z.number().int().min(30).max(86400),
  starReward: z.number().int().min(0).max(1000).default(0),
  alertMode: timerAlertModeSchema.default("completion"),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(),
  assignedToId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const syncTimerSchema = z.object({
  remainingSeconds: z.number().int().min(0),
  deviceId: z.string().min(1),
});

export const extendTimerSchema = z.object({
  seconds: z.number().int().min(60).max(3600), // 1min to 1h
});

export const confirmTimerSchema = z.object({
  confirmedById: z.string().min(1),
});

export type StartTimerFromTemplateInput = z.infer<
  typeof startTimerFromTemplateSchema
>;
export type StartOneOffTimerInput = z.infer<typeof startOneOffTimerSchema>;
export type SyncTimerInput = z.infer<typeof syncTimerSchema>;
export type ExtendTimerInput = z.infer<typeof extendTimerSchema>;
export type ConfirmTimerInput = z.infer<typeof confirmTimerSchema>;
