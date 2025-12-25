// src/server/services/child-service.ts

import { db } from "@/server/db";
import { users, familyMembers, childUpgradeTokens } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateInviteToken } from "@/lib/invite-token";

/**
 * Create a child member (placeholder user + family member)
 * Children have no password/OAuth - they're profiles managed by parents
 */
export async function createChildMember(
  familyId: string,
  name: string,
  avatarColor: string
) {
  const childId = `child_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const memberId = randomUUID();
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Create placeholder user
    const [user] = await tx
      .insert(users)
      .values({
        id: childId,
        name,
        email: `${childId}@placeholder.internal`,
        emailVerified: false,
        type: "child",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Create family member
    const [member] = await tx
      .insert(familyMembers)
      .values({
        id: memberId,
        familyId,
        userId: childId,
        role: "child",
        displayName: name,
        avatarColor,
        createdAt: now,
      })
      .returning();

    return { user, member };
  });
}

/**
 * Count children in a family (for limit enforcement)
 */
export async function countChildrenInFamily(familyId: string): Promise<number> {
  const children = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(eq(familyMembers.familyId, familyId), eq(familyMembers.role, "child"))
    );

  return children.length;
}

/**
 * Create an upgrade token for a child to link a Google account
 * Token expires in 24 hours
 */
export async function createUpgradeToken(
  childUserId: string,
  createdById: string
) {
  const tokenId = randomUUID();
  const token = generateInviteToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const [upgradeToken] = await db
    .insert(childUpgradeTokens)
    .values({
      id: tokenId,
      childUserId,
      token,
      createdById,
      expiresAt,
      createdAt: now,
    })
    .returning();

  return upgradeToken;
}

/**
 * Get upgrade token by token string
 * Returns null if not found, expired, or already used
 */
export async function getUpgradeToken(token: string) {
  const tokens = await db
    .select()
    .from(childUpgradeTokens)
    .where(eq(childUpgradeTokens.token, token))
    .limit(1);

  if (tokens.length === 0) {
    return null;
  }

  const upgradeToken = tokens[0];

  // Check if expired
  if (upgradeToken.expiresAt < new Date()) {
    return null;
  }

  // Check if already used
  if (upgradeToken.usedAt) {
    return null;
  }

  return upgradeToken;
}

/**
 * Upgrade a child to a full account
 * Links existing child profile to the new authenticated user
 */
export async function upgradeChildToAccount(
  token: string,
  newEmail: string,
  newName: string
) {
  return await db.transaction(async (tx) => {
    // Get and validate token
    const tokens = await tx
      .select()
      .from(childUpgradeTokens)
      .where(eq(childUpgradeTokens.token, token))
      .limit(1);

    if (tokens.length === 0) {
      throw new Error("Invalid token");
    }

    const upgradeToken = tokens[0];

    if (upgradeToken.expiresAt < new Date()) {
      throw new Error("Token expired");
    }

    if (upgradeToken.usedAt) {
      throw new Error("Token already used");
    }

    // Check if email already in use
    const existingUser = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, newEmail))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Email already in use");
    }

    // Update user record
    const now = new Date();
    const [updatedUser] = await tx
      .update(users)
      .set({
        email: newEmail,
        name: newName,
        type: "human",
        updatedAt: now,
      })
      .where(eq(users.id, upgradeToken.childUserId))
      .returning();

    // Update family member role
    await tx
      .update(familyMembers)
      .set({ role: "participant" })
      .where(eq(familyMembers.userId, upgradeToken.childUserId));

    // Mark token as used
    await tx
      .update(childUpgradeTokens)
      .set({ usedAt: now })
      .where(eq(childUpgradeTokens.id, upgradeToken.id));

    return updatedUser;
  });
}
