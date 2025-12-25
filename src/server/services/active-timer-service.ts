import { db } from "@/server/db";
import { activeTimers, timerTemplates } from "@/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { addStars } from "./star-service";
import { broadcastToFamily } from "@/lib/pusher";
import type {
  StartTimerFromTemplateInput,
  StartOneOffTimerInput,
  SyncTimerInput,
  ExtendTimerInput,
  ConfirmTimerInput,
} from "@/lib/validations/timer";
import type { ActiveTimer } from "@/server/schema";

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get all active timers for a family (running, paused, or expired)
 */
export async function getActiveTimersForFamily(
  familyId: string
): Promise<ActiveTimer[]> {
  return await db
    .select()
    .from(activeTimers)
    .where(
      and(
        eq(activeTimers.familyId, familyId),
        inArray(activeTimers.status, ["running", "paused", "expired"])
      )
    );
}

/**
 * Get all timers for a family (including paused)
 */
export async function getAllTimersForFamily(
  familyId: string
): Promise<ActiveTimer[]> {
  return await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.familyId, familyId));
}

/**
 * Get a single timer by ID
 */
export async function getTimerById(
  timerId: string,
  familyId: string
): Promise<ActiveTimer | null> {
  const results = await db
    .select()
    .from(activeTimers)
    .where(
      and(eq(activeTimers.id, timerId), eq(activeTimers.familyId, familyId))
    )
    .limit(1);

  return results[0] ?? null;
}

// =============================================================================
// START OPERATIONS
// =============================================================================

/**
 * Start a timer from a template
 */
export async function startTimerFromTemplate(
  familyId: string,
  input: StartTimerFromTemplateInput
): Promise<ActiveTimer> {
  // Get template
  const template = await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.id, input.templateId),
        eq(timerTemplates.familyId, familyId)
      )
    )
    .limit(1);

  if (template.length === 0) throw new Error("Template not found");
  const t = template[0];

  const timerId = createId();
  const now = new Date();

  const [timer] = await db
    .insert(activeTimers)
    .values({
      id: timerId,
      familyId,
      templateId: t.id,
      title: t.title,
      description: t.description,
      assignedToId: input.assignedToId,
      category: t.category,
      durationSeconds: t.durationSeconds,
      starReward: t.starReward,
      alertMode: t.alertMode,
      cooldownSeconds: t.cooldownSeconds,
      status: "running",
      remainingSeconds: t.durationSeconds,
      startedAt: now,
      startedById: input.assignedToId,
      ownerDeviceId: input.deviceId,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  broadcastToFamily(familyId, "timer:started", { timer });

  return timer;
}

/**
 * Start a one-off timer
 */
export async function startOneOffTimer(
  familyId: string,
  input: StartOneOffTimerInput
): Promise<ActiveTimer> {
  const timerId = createId();
  const now = new Date();

  const [timer] = await db
    .insert(activeTimers)
    .values({
      id: timerId,
      familyId,
      templateId: null,
      title: input.title,
      description: input.description ?? null,
      assignedToId: input.assignedToId,
      category: input.category,
      durationSeconds: input.durationSeconds,
      starReward: input.starReward,
      alertMode: input.alertMode,
      cooldownSeconds: input.cooldownSeconds ?? null,
      status: "running",
      remainingSeconds: input.durationSeconds,
      startedAt: now,
      startedById: input.assignedToId,
      ownerDeviceId: input.deviceId,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  broadcastToFamily(familyId, "timer:started", { timer });

  return timer;
}

// =============================================================================
// CONTROL OPERATIONS
// =============================================================================

/**
 * Pause a running timer
 */
export async function pauseTimer(
  timerId: string,
  familyId: string,
  deviceId: string
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status !== "running") throw new Error("Timer is not running");
  if (timer.ownerDeviceId !== deviceId) throw new Error("Not the owner device");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "paused",
      pausedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  broadcastToFamily(familyId, "timer:updated", { timer: updated });

  return updated;
}

/**
 * Resume a paused timer
 */
export async function resumeTimer(
  timerId: string,
  familyId: string,
  deviceId: string
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status !== "paused") throw new Error("Timer is not paused");
  if (timer.ownerDeviceId !== deviceId) throw new Error("Not the owner device");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "running",
      pausedAt: null,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  broadcastToFamily(familyId, "timer:updated", { timer: updated });

  return updated;
}

/**
 * Extend a timer's duration
 */
export async function extendTimer(
  timerId: string,
  familyId: string,
  input: ExtendTimerInput
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status === "completed" || timer.status === "cancelled") {
    throw new Error("Cannot extend a finished timer");
  }

  const [updated] = await db
    .update(activeTimers)
    .set({
      remainingSeconds: timer.remainingSeconds + input.seconds,
      durationSeconds: timer.durationSeconds + input.seconds,
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  broadcastToFamily(familyId, "timer:updated", { timer: updated });

  return updated;
}

/**
 * Cancel a timer
 */
export async function cancelTimer(
  timerId: string,
  familyId: string
): Promise<void> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");

  await db
    .update(activeTimers)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId));

  broadcastToFamily(familyId, "timer:cancelled", { timerId });
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

/**
 * Sync timer state from owner device
 */
export async function syncTimerState(
  timerId: string,
  familyId: string,
  input: SyncTimerInput
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.ownerDeviceId !== input.deviceId)
    throw new Error("Not the owner device");

  const updates: Record<string, unknown> = {
    remainingSeconds: input.remainingSeconds,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  };

  // If timer reached zero, mark as waiting for confirmation or completed
  if (input.remainingSeconds <= 0 && timer.status === "running") {
    if (timer.cooldownSeconds && timer.cooldownSeconds > 0) {
      // Has cooldown - wait for confirmation
      updates.status = "expired";
      updates.completedAt = new Date();
    } else {
      // No cooldown - just complete
      updates.status = "completed";
      updates.completedAt = new Date();
    }
  }

  const [updated] = await db
    .update(activeTimers)
    .set(updates)
    .where(eq(activeTimers.id, timerId))
    .returning();

  broadcastToFamily(familyId, "timer:updated", { timer: updated });

  return updated;
}

/**
 * Claim an orphaned timer
 */
export async function claimOrphanedTimer(
  timerId: string,
  familyId: string,
  deviceId: string
): Promise<ActiveTimer | null> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) return null;
  if (timer.status !== "running" && timer.status !== "paused") return null;

  // Check if orphaned (no sync in 60+ seconds)
  const orphanThreshold = new Date(Date.now() - 60000);
  if (timer.lastSyncAt && timer.lastSyncAt > orphanThreshold) {
    return null; // Not orphaned
  }

  const [updated] = await db
    .update(activeTimers)
    .set({
      ownerDeviceId: deviceId,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

// =============================================================================
// COMPLETION OPERATIONS
// =============================================================================

/**
 * Confirm timer completion (for reward)
 */
export async function confirmTimer(
  timerId: string,
  familyId: string,
  input: ConfirmTimerInput
): Promise<{ timer: ActiveTimer; starsAwarded: number }> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status !== "expired") {
    throw new Error("Timer is not awaiting confirmation");
  }

  // Check if within cooldown period
  if (timer.completedAt && timer.cooldownSeconds) {
    const cooldownEnd = new Date(
      timer.completedAt.getTime() + timer.cooldownSeconds * 1000
    );
    if (new Date() > cooldownEnd) {
      throw new Error("Confirmation period has expired");
    }
  }

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "completed",
      confirmedById: input.confirmedById,
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  // Award stars if applicable
  let starsAwarded = 0;
  if (timer.starReward > 0 && timer.assignedToId) {
    await addStars({
      memberId: timer.assignedToId,
      amount: timer.starReward,
      type: "timer",
      referenceId: timerId,
      description: timer.title,
    });
    starsAwarded = timer.starReward;
  }

  broadcastToFamily(familyId, "timer:completed", {
    timer: updated,
    starsAwarded,
  });

  return { timer: updated, starsAwarded };
}

/**
 * Complete timer without reward (missed cooldown)
 */
export async function expireTimer(
  timerId: string,
  familyId: string
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

/**
 * Dismiss a timer (for missed cooldown or cancelled)
 */
export async function dismissTimer(
  timerId: string,
  familyId: string
): Promise<void> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");

  await db
    .update(activeTimers)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId));

  broadcastToFamily(familyId, "timer:completed", {
    timer: { ...timer, status: "completed" },
  });
}

/**
 * Acknowledge a completed timer (no cooldown, just mark as done)
 */
export async function acknowledgeTimer(
  timerId: string,
  familyId: string
): Promise<{ timer: ActiveTimer; starsAwarded: number }> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  // Award stars if applicable (for timers without cooldown)
  let starsAwarded = 0;
  if (timer.starReward > 0 && timer.assignedToId) {
    await addStars({
      memberId: timer.assignedToId,
      amount: timer.starReward,
      type: "timer",
      referenceId: timerId,
      description: timer.title,
    });
    starsAwarded = timer.starReward;
  }

  broadcastToFamily(familyId, "timer:completed", {
    timer: updated,
    starsAwarded,
  });

  return { timer: updated, starsAwarded };
}
