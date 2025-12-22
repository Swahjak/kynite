import { db } from "@/server/db";
import { chores, familyMembers, users } from "@/server/schema";
import { eq, and, gte, lte, desc, asc, isNull, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  CreateChoreInput,
  UpdateChoreInput,
  ChoreQueryInput,
} from "@/lib/validations/chore";
import type { IChoreWithAssignee } from "@/types/chore";

// =============================================================================
// HELPER: Build chore with assignee from row
// =============================================================================

function buildChoreWithAssignee(row: {
  chore: typeof chores.$inferSelect;
  assignedMember: typeof familyMembers.$inferSelect | null;
  assignedUser: typeof users.$inferSelect | null;
  completedMember: typeof familyMembers.$inferSelect | null;
  completedUser: typeof users.$inferSelect | null;
}): IChoreWithAssignee {
  return {
    ...row.chore,
    recurrence: row.chore.recurrence as IChoreWithAssignee["recurrence"],
    status: row.chore.status as IChoreWithAssignee["status"],
    assignedTo:
      row.assignedMember && row.assignedUser
        ? {
            id: row.assignedMember.id,
            familyId: row.assignedMember.familyId,
            userId: row.assignedMember.userId,
            role: row.assignedMember.role as "manager" | "participant" | "caregiver",
            displayName: row.assignedMember.displayName,
            avatarColor: row.assignedMember.avatarColor,
            createdAt: row.assignedMember.createdAt,
            user: {
              id: row.assignedUser.id,
              name: row.assignedUser.name,
              email: row.assignedUser.email,
              image: row.assignedUser.image,
            },
          }
        : null,
    completedBy:
      row.completedMember && row.completedUser
        ? {
            id: row.completedMember.id,
            familyId: row.completedMember.familyId,
            userId: row.completedMember.userId,
            role: row.completedMember.role as "manager" | "participant" | "caregiver",
            displayName: row.completedMember.displayName,
            avatarColor: row.completedMember.avatarColor,
            createdAt: row.completedMember.createdAt,
            user: {
              id: row.completedUser.id,
              name: row.completedUser.name,
              email: row.completedUser.email,
              image: row.completedUser.image,
            },
          }
        : null,
  };
}

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Alias tables for multiple joins to same table
 */
const assignedMembers = familyMembers;
const completedMembers = familyMembers;
const assignedUsers = users;
const completedUsers = users;

/**
 * Get all chores for a family with optional filters
 */
export async function getChoresForFamily(
  familyId: string,
  query?: ChoreQueryInput
): Promise<IChoreWithAssignee[]> {
  const conditions = [eq(chores.familyId, familyId)];

  if (query?.status) {
    conditions.push(eq(chores.status, query.status));
  }
  if (query?.isUrgent !== undefined) {
    conditions.push(eq(chores.isUrgent, query.isUrgent));
  }
  if (query?.startDate) {
    conditions.push(
      or(gte(chores.dueDate, query.startDate), isNull(chores.dueDate))!
    );
  }
  if (query?.endDate) {
    conditions.push(
      or(lte(chores.dueDate, query.endDate), isNull(chores.dueDate))!
    );
  }

  const rows = await db
    .select({
      chore: chores,
      assignedMember: assignedMembers,
      assignedUser: assignedUsers,
      completedMember: completedMembers,
      completedUser: completedUsers,
    })
    .from(chores)
    .leftJoin(assignedMembers, eq(chores.assignedToId, assignedMembers.id))
    .leftJoin(assignedUsers, eq(assignedMembers.userId, assignedUsers.id))
    .leftJoin(completedMembers, eq(chores.completedById, completedMembers.id))
    .leftJoin(completedUsers, eq(completedMembers.userId, completedUsers.id))
    .where(and(...conditions))
    .orderBy(asc(chores.dueDate), asc(chores.dueTime), asc(chores.createdAt));

  let result = rows.map(buildChoreWithAssignee);

  // Filter by assignedToIds in memory (complex OR query)
  if (query?.assignedToIds && query.assignedToIds.length > 0) {
    result = result.filter(
      (c) => c.assignedToId && query.assignedToIds!.includes(c.assignedToId)
    );
  }

  return result;
}

/**
 * Get a single chore by ID
 */
export async function getChoreById(
  choreId: string,
  familyId: string
): Promise<IChoreWithAssignee | null> {
  const rows = await db
    .select({
      chore: chores,
      assignedMember: assignedMembers,
      assignedUser: assignedUsers,
      completedMember: completedMembers,
      completedUser: completedUsers,
    })
    .from(chores)
    .leftJoin(assignedMembers, eq(chores.assignedToId, assignedMembers.id))
    .leftJoin(assignedUsers, eq(assignedMembers.userId, assignedUsers.id))
    .leftJoin(completedMembers, eq(chores.completedById, completedMembers.id))
    .leftJoin(completedUsers, eq(completedMembers.userId, completedUsers.id))
    .where(and(eq(chores.id, choreId), eq(chores.familyId, familyId)))
    .limit(1);

  if (rows.length === 0) return null;
  return buildChoreWithAssignee(rows[0]);
}

// =============================================================================
// MUTATION OPERATIONS
// =============================================================================

/**
 * Create a new chore
 */
export async function createChore(
  familyId: string,
  input: CreateChoreInput
): Promise<IChoreWithAssignee> {
  const choreId = createId();
  const now = new Date();

  await db.insert(chores).values({
    id: choreId,
    familyId,
    title: input.title,
    description: input.description ?? null,
    assignedToId: input.assignedToId ?? null,
    dueDate: input.dueDate ?? null,
    dueTime: input.dueTime ?? null,
    recurrence: input.recurrence ?? "once",
    isUrgent: input.isUrgent ?? false,
    status: "pending",
    starReward: input.starReward ?? 10,
    createdAt: now,
    updatedAt: now,
  });

  const chore = await getChoreById(choreId, familyId);
  if (!chore) throw new Error("Failed to create chore");
  return chore;
}

/**
 * Update an existing chore
 */
export async function updateChore(
  choreId: string,
  familyId: string,
  input: UpdateChoreInput
): Promise<IChoreWithAssignee> {
  const existing = await getChoreById(choreId, familyId);
  if (!existing) throw new Error("Chore not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.assignedToId !== undefined) updates.assignedToId = input.assignedToId;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
  if (input.dueTime !== undefined) updates.dueTime = input.dueTime;
  if (input.recurrence !== undefined) updates.recurrence = input.recurrence;
  if (input.isUrgent !== undefined) updates.isUrgent = input.isUrgent;
  if (input.starReward !== undefined) updates.starReward = input.starReward;

  await db.update(chores).set(updates).where(eq(chores.id, choreId));

  const chore = await getChoreById(choreId, familyId);
  if (!chore) throw new Error("Failed to update chore");
  return chore;
}

/**
 * Delete a chore
 */
export async function deleteChore(choreId: string, familyId: string): Promise<void> {
  const existing = await getChoreById(choreId, familyId);
  if (!existing) throw new Error("Chore not found");

  await db.delete(chores).where(eq(chores.id, choreId));
}

/**
 * Complete a chore
 */
export async function completeChore(
  choreId: string,
  familyId: string,
  completedById: string
): Promise<IChoreWithAssignee> {
  const existing = await getChoreById(choreId, familyId);
  if (!existing) throw new Error("Chore not found");
  if (existing.status === "completed") throw new Error("Chore already completed");

  await db
    .update(chores)
    .set({
      status: "completed",
      completedAt: new Date(),
      completedById,
      updatedAt: new Date(),
    })
    .where(eq(chores.id, choreId));

  const chore = await getChoreById(choreId, familyId);
  if (!chore) throw new Error("Failed to complete chore");
  return chore;
}

/**
 * Undo chore completion
 */
export async function undoChoreCompletion(
  choreId: string,
  familyId: string
): Promise<IChoreWithAssignee> {
  const existing = await getChoreById(choreId, familyId);
  if (!existing) throw new Error("Chore not found");
  if (existing.status !== "completed") throw new Error("Chore is not completed");

  await db
    .update(chores)
    .set({
      status: "pending",
      completedAt: null,
      completedById: null,
      updatedAt: new Date(),
    })
    .where(eq(chores.id, choreId));

  const chore = await getChoreById(choreId, familyId);
  if (!chore) throw new Error("Failed to undo completion");
  return chore;
}

// =============================================================================
// PROGRESS OPERATIONS
// =============================================================================

/**
 * Get today's chore progress for a family
 */
export async function getChoreProgress(
  familyId: string,
  date?: string
): Promise<{ completed: number; total: number; percentage: number }> {
  const targetDate = date ?? new Date().toISOString().split("T")[0];

  // Get all pending chores due today or earlier, plus completed today
  const allChores = await db
    .select()
    .from(chores)
    .where(eq(chores.familyId, familyId));

  const relevantChores = allChores.filter((c) => {
    // Include if completed today
    if (c.status === "completed" && c.completedAt) {
      const completedDate = c.completedAt.toISOString().split("T")[0];
      return completedDate === targetDate;
    }
    // Include if pending and due today or earlier (or no due date for daily tasks)
    if (c.status === "pending") {
      if (!c.dueDate) return c.recurrence !== "once"; // Recurring without date
      return c.dueDate <= targetDate;
    }
    return false;
  });

  const completed = relevantChores.filter((c) => c.status === "completed").length;
  const total = relevantChores.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}
