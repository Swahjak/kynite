// src/server/services/family-service.ts

import { db } from "@/server/db";
import { families, familyMembers, familyInvites, users } from "@/server/schema";
import { eq, and, gt } from "drizzle-orm";
import type { FamilyMemberWithUser, FamilyMemberRole } from "@/types/family";
import { generateInviteToken } from "@/lib/invite-token";
import { randomUUID } from "crypto";

/**
 * Get user's family membership with their role
 * Returns null if user is not in any family
 */
export async function getUserFamily(userId: string) {
  const membership = await db
    .select({
      familyId: familyMembers.familyId,
      role: familyMembers.role,
    })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1);

  if (membership.length === 0) {
    return null;
  }

  const family = await db
    .select()
    .from(families)
    .where(eq(families.id, membership[0].familyId))
    .limit(1);

  if (family.length === 0) {
    return null;
  }

  return {
    ...family[0],
    currentUserRole: membership[0].role as FamilyMemberRole,
  };
}

/**
 * Get all human members of a family with user data joined
 * Excludes device accounts - use getDevicesForFamily from device-service for devices
 */
export async function getFamilyMembers(
  familyId: string
): Promise<FamilyMemberWithUser[]> {
  const members = await db
    .select({
      id: familyMembers.id,
      familyId: familyMembers.familyId,
      userId: familyMembers.userId,
      role: familyMembers.role,
      displayName: familyMembers.displayName,
      avatarColor: familyMembers.avatarColor,
      createdAt: familyMembers.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, familyId));

  return members
    .filter((m) => m.role !== "device")
    .map((m) => ({
      ...m,
      role: m.role as FamilyMemberRole,
    }));
}

/**
 * Create a new family and add the creator as a manager
 * Uses transaction to ensure both family and membership are created atomically
 */
export async function createFamily(userId: string, name: string) {
  const familyId = randomUUID();
  const memberId = randomUUID();
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Create family
    const [family] = await tx
      .insert(families)
      .values({
        id: familyId,
        name,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Add creator as manager
    const [member] = await tx
      .insert(familyMembers)
      .values({
        id: memberId,
        familyId,
        userId,
        role: "manager",
        createdAt: now,
      })
      .returning();

    return {
      family,
      membership: member,
    };
  });
}

/**
 * Add a user to a family with the specified role
 */
export async function addMemberToFamily(
  familyId: string,
  userId: string,
  role: FamilyMemberRole
) {
  const memberId = randomUUID();
  const now = new Date();

  const [member] = await db
    .insert(familyMembers)
    .values({
      id: memberId,
      familyId,
      userId,
      role,
      createdAt: now,
    })
    .returning();

  return member;
}

/**
 * Update a family member's display name, avatar color, or role
 */
export async function updateMember(
  memberId: string,
  data: {
    displayName?: string | null;
    avatarColor?: string | null;
    role?: FamilyMemberRole;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName;
  }
  if (data.avatarColor !== undefined) {
    updateData.avatarColor = data.avatarColor;
  }
  if (data.role !== undefined) {
    updateData.role = data.role;
  }

  if (Object.keys(updateData).length === 0) {
    // No updates provided
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId))
      .limit(1);
    return member;
  }

  const [updated] = await db
    .update(familyMembers)
    .set(updateData)
    .where(eq(familyMembers.id, memberId))
    .returning();

  return updated;
}

/**
 * Remove a member from a family
 */
export async function removeMember(memberId: string) {
  const [deleted] = await db
    .delete(familyMembers)
    .where(eq(familyMembers.id, memberId))
    .returning();

  return deleted;
}

/**
 * Create a family invite with optional expiry and max uses
 */
export async function createInvite(
  familyId: string,
  createdById: string,
  options?: {
    expiresInDays?: number;
    maxUses?: number;
  }
) {
  const inviteId = randomUUID();
  const token = generateInviteToken();
  const now = new Date();

  const expiresAt = options?.expiresInDays
    ? new Date(now.getTime() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [invite] = await db
    .insert(familyInvites)
    .values({
      id: inviteId,
      familyId,
      token,
      createdById,
      expiresAt,
      maxUses: options?.maxUses ?? null,
      useCount: 0,
      createdAt: now,
    })
    .returning();

  return invite;
}

/**
 * Get invite by token with family name
 * Returns null if invite not found
 */
export async function getInviteByToken(token: string) {
  const invites = await db
    .select({
      id: familyInvites.id,
      familyId: familyInvites.familyId,
      token: familyInvites.token,
      createdById: familyInvites.createdById,
      expiresAt: familyInvites.expiresAt,
      maxUses: familyInvites.maxUses,
      useCount: familyInvites.useCount,
      createdAt: familyInvites.createdAt,
      familyName: families.name,
    })
    .from(familyInvites)
    .innerJoin(families, eq(familyInvites.familyId, families.id))
    .where(eq(familyInvites.token, token))
    .limit(1);

  if (invites.length === 0) {
    return null;
  }

  return invites[0];
}

/**
 * Accept an invite and add user to family
 * Validates invite expiry and max uses
 * Increments use count on successful acceptance
 * Uses transaction to ensure atomicity
 */
export async function acceptInvite(token: string, userId: string) {
  return await db.transaction(async (tx) => {
    // Get invite
    const invites = await tx
      .select()
      .from(familyInvites)
      .where(eq(familyInvites.token, token))
      .limit(1);

    if (invites.length === 0) {
      throw new Error("Invite not found");
    }

    const invite = invites[0];

    // Check if expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error("Invite has expired");
    }

    // Check if max uses reached
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw new Error("Invite has reached maximum uses");
    }

    // Check if user is already a member
    const existingMembership = await tx
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, invite.familyId),
          eq(familyMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      throw new Error("User is already a member of this family");
    }

    // Add user to family as participant
    const memberId = randomUUID();
    const now = new Date();

    const [member] = await tx
      .insert(familyMembers)
      .values({
        id: memberId,
        familyId: invite.familyId,
        userId,
        role: "participant",
        createdAt: now,
      })
      .returning();

    // Increment use count
    await tx
      .update(familyInvites)
      .set({ useCount: invite.useCount + 1 })
      .where(eq(familyInvites.id, invite.id));

    return {
      member,
      familyId: invite.familyId,
    };
  });
}

/**
 * Delete an invite
 */
export async function deleteInvite(inviteId: string) {
  const [deleted] = await db
    .delete(familyInvites)
    .where(eq(familyInvites.id, inviteId))
    .returning();

  return deleted;
}

/**
 * Check if a user is a manager of a family
 */
export async function isUserFamilyManager(
  userId: string,
  familyId: string
): Promise<boolean> {
  const membership = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return membership.length > 0 && membership[0].role === "manager";
}

/**
 * Check if a user is a member of a family (any role)
 */
export async function isUserFamilyMember(
  userId: string,
  familyId: string
): Promise<boolean> {
  const membership = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return membership.length > 0;
}

/**
 * Get a family member by userId and familyId
 * Returns null if user is not a member
 */
export async function getMemberByUserId(userId: string, familyId: string) {
  const result = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get a family member by userId and familyId
 * Alias for getMemberByUserId
 * Returns null if user is not a member
 */
export async function getFamilyMemberByUserId(
  userId: string,
  familyId: string
) {
  return getMemberByUserId(userId, familyId);
}
