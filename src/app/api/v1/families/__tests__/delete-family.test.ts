import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/server/db";
import { users, families, familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Mock auth
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock stopWatchChannel to avoid calling Google API
vi.mock("@/server/services/google-channel-service", () => ({
  stopWatchChannel: vi.fn().mockResolvedValue(undefined),
}));

describe("DELETE /api/v1/families/[familyId]", () => {
  const testIds = {
    ownerId: randomUUID(),
    memberId: randomUUID(),
    familyId: randomUUID(),
    ownerMemberId: randomUUID(),
    memberMemberId: randomUUID(),
  };

  beforeEach(async () => {
    // Create owner user
    await db.insert(users).values({
      id: testIds.ownerId,
      name: "Owner",
      email: `owner-${testIds.ownerId}@example.com`,
    });

    // Create member user
    await db.insert(users).values({
      id: testIds.memberId,
      name: "Member",
      email: `member-${testIds.memberId}@example.com`,
    });

    // Create family
    await db.insert(families).values({
      id: testIds.familyId,
      name: "Test Family",
    });

    // Add owner as manager
    await db.insert(familyMembers).values({
      id: testIds.ownerMemberId,
      familyId: testIds.familyId,
      userId: testIds.ownerId,
      role: "manager",
    });

    // Add member as participant
    await db.insert(familyMembers).values({
      id: testIds.memberMemberId,
      familyId: testIds.familyId,
      userId: testIds.memberId,
      role: "participant",
    });
  });

  afterEach(async () => {
    // Clean up any remaining data
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.familyId, testIds.familyId));
    await db.delete(families).where(eq(families.id, testIds.familyId));
    await db.delete(users).where(eq(users.id, testIds.ownerId));
    await db.delete(users).where(eq(users.id, testIds.memberId));
  });

  it("should delete family and all user accounts", async () => {
    const { auth } = await import("@/server/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: testIds.ownerId },
      session: { id: "session-1" },
    } as any);

    const { DELETE } = await import("../[familyId]/route");

    const request = new Request(
      "http://localhost/api/v1/families/" + testIds.familyId,
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ familyId: testIds.familyId }),
    });

    expect(response.status).toBe(200);

    // Verify family is deleted
    const familyAfter = await db
      .select()
      .from(families)
      .where(eq(families.id, testIds.familyId));
    expect(familyAfter).toHaveLength(0);

    // Verify all users are deleted
    const ownerAfter = await db
      .select()
      .from(users)
      .where(eq(users.id, testIds.ownerId));
    expect(ownerAfter).toHaveLength(0);

    const memberAfter = await db
      .select()
      .from(users)
      .where(eq(users.id, testIds.memberId));
    expect(memberAfter).toHaveLength(0);
  });
});
