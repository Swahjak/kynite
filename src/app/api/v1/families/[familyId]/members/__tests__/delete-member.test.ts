import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/server/db";
import { users, families, familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

describe("DELETE /api/v1/families/[familyId]/members/[memberId]", () => {
  const testIds = {
    managerId: randomUUID(),
    participantId: randomUUID(),
    familyId: randomUUID(),
    managerMemberId: randomUUID(),
    participantMemberId: randomUUID(),
  };

  beforeEach(async () => {
    await db.insert(users).values([
      {
        id: testIds.managerId,
        name: "Manager",
        email: `mgr-${testIds.managerId}@example.com`,
      },
      {
        id: testIds.participantId,
        name: "Participant",
        email: `part-${testIds.participantId}@example.com`,
      },
    ]);

    await db.insert(families).values({
      id: testIds.familyId,
      name: "Test Family",
    });

    await db.insert(familyMembers).values([
      {
        id: testIds.managerMemberId,
        familyId: testIds.familyId,
        userId: testIds.managerId,
        role: "manager",
      },
      {
        id: testIds.participantMemberId,
        familyId: testIds.familyId,
        userId: testIds.participantId,
        role: "participant",
      },
    ]);
  });

  afterEach(async () => {
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.familyId, testIds.familyId));
    await db.delete(families).where(eq(families.id, testIds.familyId));
    await db.delete(users).where(eq(users.id, testIds.managerId));
    await db.delete(users).where(eq(users.id, testIds.participantId));
  });

  it("should delete member and their user account", async () => {
    const { auth } = await import("@/server/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: testIds.managerId },
      session: { id: "session-1" },
    } as any);

    const { DELETE } = await import("../[memberId]/route");

    const request = new Request("http://localhost/test", { method: "DELETE" });

    const response = await DELETE(request, {
      params: Promise.resolve({
        familyId: testIds.familyId,
        memberId: testIds.participantMemberId,
      }),
    });

    expect(response.status).toBe(200);

    // Verify member is deleted
    const memberAfter = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, testIds.participantMemberId));
    expect(memberAfter).toHaveLength(0);

    // Verify user account is deleted
    const userAfter = await db
      .select()
      .from(users)
      .where(eq(users.id, testIds.participantId));
    expect(userAfter).toHaveLength(0);
  });
});
