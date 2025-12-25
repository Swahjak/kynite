import { randomInt } from "crypto";
import { db } from "@/server/db";
import {
  devicePairingCodes,
  users,
  familyMembers,
  sessions,
} from "@/server/schema";
import { eq, and, gt, isNull, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const CODE_EXPIRY_MINUTES = 5;
export const DEVICE_SESSION_EXPIRY_DAYS = 90;
export const MAX_PAIRING_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure random 6-digit pairing code
 */
function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

/**
 * Create a new pairing code for a device
 */
export async function createPairingCode(
  familyId: string,
  createdById: string,
  deviceName: string
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(devicePairingCodes).values({
    id: createId(),
    familyId,
    code,
    deviceName,
    createdById,
    expiresAt,
  });

  return { code, expiresAt };
}

/**
 * Validate and consume a pairing code
 * Returns the pairing code record if valid, null otherwise
 */
export async function consumePairingCode(code: string) {
  const now = new Date();

  // Find valid, unused, non-expired code
  const [pairingCode] = await db
    .select()
    .from(devicePairingCodes)
    .where(
      and(
        eq(devicePairingCodes.code, code),
        gt(devicePairingCodes.expiresAt, now),
        isNull(devicePairingCodes.usedAt)
      )
    )
    .limit(1);

  if (!pairingCode) {
    return null;
  }

  // Mark as used
  await db
    .update(devicePairingCodes)
    .set({ usedAt: now })
    .where(eq(devicePairingCodes.id, pairingCode.id));

  return pairingCode;
}

/**
 * Create a device user and family membership
 */
export async function createDeviceUser(
  familyId: string,
  deviceName: string
): Promise<{ userId: string; memberId: string }> {
  const userId = createId();
  const memberId = createId();
  const email = `device-${userId}@internal.local`;

  // Create device user
  await db.insert(users).values({
    id: userId,
    name: deviceName,
    email,
    emailVerified: true,
    type: "device",
  });

  // Create family membership
  await db.insert(familyMembers).values({
    id: memberId,
    familyId,
    userId,
    role: "device",
    displayName: deviceName,
  });

  return { userId, memberId };
}

/**
 * Get all devices for a family
 */
export async function getDevicesForFamily(familyId: string) {
  const devices = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: familyMembers.displayName,
      createdAt: users.createdAt,
      memberId: familyMembers.id,
    })
    .from(users)
    .innerJoin(familyMembers, eq(familyMembers.userId, users.id))
    .where(and(eq(familyMembers.familyId, familyId), eq(users.type, "device")));

  // Get last activity for each device
  const devicesWithActivity = await Promise.all(
    devices.map(async (device) => {
      const [lastSession] = await db
        .select({ updatedAt: sessions.updatedAt })
        .from(sessions)
        .where(eq(sessions.userId, device.id))
        .orderBy(sql`${sessions.updatedAt} DESC`)
        .limit(1);

      return {
        ...device,
        lastActiveAt: lastSession?.updatedAt ?? device.createdAt,
      };
    })
  );

  return devicesWithActivity;
}

/**
 * Update device name
 */
export async function updateDeviceName(
  deviceUserId: string,
  newName: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name: newName })
      .where(eq(users.id, deviceUserId));

    await tx
      .update(familyMembers)
      .set({ displayName: newName })
      .where(eq(familyMembers.userId, deviceUserId));
  });
}

/**
 * Delete a device (user, family member, and sessions)
 */
export async function deleteDevice(deviceUserId: string): Promise<void> {
  // Delete user (CASCADE will handle familyMembers and sessions)
  await db.delete(users).where(eq(users.id, deviceUserId));
}

/**
 * Verify a device belongs to a family
 */
export async function verifyDeviceInFamily(
  deviceUserId: string,
  familyId: string
): Promise<boolean> {
  const [member] = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, deviceUserId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return !!member;
}

/**
 * Clean up expired pairing codes (for cron job)
 */
export async function cleanupExpiredPairingCodes(): Promise<number> {
  const result = await db
    .delete(devicePairingCodes)
    .where(sql`${devicePairingCodes.expiresAt} < NOW()`)
    .returning({ id: devicePairingCodes.id });

  return result.length;
}

/**
 * Record a failed pairing attempt
 * Returns false if code is now invalidated (max attempts reached)
 */
export async function recordFailedAttempt(code: string): Promise<boolean> {
  const result = await db
    .update(devicePairingCodes)
    .set({
      attempts: sql`${devicePairingCodes.attempts} + 1`,
    })
    .where(eq(devicePairingCodes.code, code))
    .returning({ attempts: devicePairingCodes.attempts });

  if (result.length === 0) {
    return false;
  }

  return result[0].attempts < MAX_PAIRING_ATTEMPTS;
}

/**
 * Check if a code has exceeded max attempts
 */
export async function isCodeInvalidated(code: string): Promise<boolean> {
  const [pairingCode] = await db
    .select({ attempts: devicePairingCodes.attempts })
    .from(devicePairingCodes)
    .where(eq(devicePairingCodes.code, code))
    .limit(1);

  return pairingCode ? pairingCode.attempts >= MAX_PAIRING_ATTEMPTS : true;
}
