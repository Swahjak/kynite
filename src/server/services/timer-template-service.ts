import { db } from "@/server/db";
import { timerTemplates } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  CreateTimerTemplateInput,
  UpdateTimerTemplateInput,
} from "@/lib/validations/timer";
import type { TimerTemplate } from "@/server/schema";

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get all timer templates for a family
 */
export async function getTemplatesForFamily(
  familyId: string
): Promise<TimerTemplate[]> {
  return await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.familyId, familyId),
        eq(timerTemplates.isActive, true)
      )
    );
}

/**
 * Get quick action templates for a family
 */
export async function getQuickActionTemplates(
  familyId: string
): Promise<TimerTemplate[]> {
  return await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.familyId, familyId),
        eq(timerTemplates.isActive, true),
        eq(timerTemplates.showAsQuickAction, true)
      )
    );
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  templateId: string,
  familyId: string
): Promise<TimerTemplate | null> {
  const results = await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.id, templateId),
        eq(timerTemplates.familyId, familyId)
      )
    )
    .limit(1);

  return results[0] ?? null;
}

// =============================================================================
// MUTATION OPERATIONS
// =============================================================================

/**
 * Create a new timer template
 */
export async function createTemplate(
  familyId: string,
  input: CreateTimerTemplateInput
): Promise<TimerTemplate> {
  const templateId = createId();
  const now = new Date();

  const [template] = await db
    .insert(timerTemplates)
    .values({
      id: templateId,
      familyId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      durationSeconds: input.durationSeconds,
      starReward: input.starReward,
      controlMode: input.controlMode,
      alertMode: input.alertMode,
      cooldownSeconds: input.cooldownSeconds ?? null,
      showAsQuickAction: input.showAsQuickAction,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return template;
}

/**
 * Update an existing timer template
 */
export async function updateTemplate(
  templateId: string,
  familyId: string,
  input: UpdateTimerTemplateInput
): Promise<TimerTemplate> {
  const existing = await getTemplateById(templateId, familyId);
  if (!existing) throw new Error("Template not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.durationSeconds !== undefined)
    updates.durationSeconds = input.durationSeconds;
  if (input.starReward !== undefined) updates.starReward = input.starReward;
  if (input.controlMode !== undefined) updates.controlMode = input.controlMode;
  if (input.alertMode !== undefined) updates.alertMode = input.alertMode;
  if (input.cooldownSeconds !== undefined)
    updates.cooldownSeconds = input.cooldownSeconds;
  if (input.showAsQuickAction !== undefined)
    updates.showAsQuickAction = input.showAsQuickAction;

  const [template] = await db
    .update(timerTemplates)
    .set(updates)
    .where(eq(timerTemplates.id, templateId))
    .returning();

  return template;
}

/**
 * Soft delete a timer template
 */
export async function deleteTemplate(
  templateId: string,
  familyId: string
): Promise<void> {
  const existing = await getTemplateById(templateId, familyId);
  if (!existing) throw new Error("Template not found");

  await db
    .update(timerTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(timerTemplates.id, templateId));
}
