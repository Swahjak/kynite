import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Skip these integration tests if no database is available
const hasDatabase = !!process.env.DATABASE_URL;

describe.skipIf(!hasDatabase)("cascade delete behavior", () => {
  const testIds = {
    userId: randomUUID(),
    familyId: randomUUID(),
    memberId: randomUUID(),
    accountId: randomUUID(),
    calendarId: randomUUID(),
    eventId: randomUUID(),
  };

  beforeEach(async () => {
    const { db } = await import("@/server/db");
    const { users, families, familyMembers, accounts } =
      await import("@/server/schema");
    const { googleCalendars, events } =
      await import("@/server/schema/calendars");

    // Create test user
    await db.insert(users).values({
      id: testIds.userId,
      name: "Test User",
      email: `test-${testIds.userId}@example.com`,
    });

    // Create test family
    await db.insert(families).values({
      id: testIds.familyId,
      name: "Test Family",
    });

    // Create family member
    await db.insert(familyMembers).values({
      id: testIds.memberId,
      familyId: testIds.familyId,
      userId: testIds.userId,
      role: "manager",
    });

    // Create test account
    await db.insert(accounts).values({
      id: testIds.accountId,
      userId: testIds.userId,
      accountId: "google-123",
      providerId: "google",
    });

    // Create test calendar
    await db.insert(googleCalendars).values({
      id: testIds.calendarId,
      familyId: testIds.familyId,
      accountId: testIds.accountId,
      googleCalendarId: "primary",
      name: "Test Calendar",
    });

    // Create test event linked to calendar
    await db.insert(events).values({
      id: testIds.eventId,
      familyId: testIds.familyId,
      googleCalendarId: testIds.calendarId,
      title: "Test Event",
      startTime: new Date(),
      endTime: new Date(),
    });
  });

  afterEach(async () => {
    const { db } = await import("@/server/db");
    const { users, families, familyMembers, accounts } =
      await import("@/server/schema");
    const { googleCalendars, events } =
      await import("@/server/schema/calendars");

    // Clean up in reverse dependency order
    await db.delete(events).where(eq(events.familyId, testIds.familyId));
    await db
      .delete(googleCalendars)
      .where(eq(googleCalendars.id, testIds.calendarId));
    await db.delete(accounts).where(eq(accounts.id, testIds.accountId));
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.id, testIds.memberId));
    await db.delete(families).where(eq(families.id, testIds.familyId));
    await db.delete(users).where(eq(users.id, testIds.userId));
  });

  it("should cascade delete events when calendar is deleted", async () => {
    const { db } = await import("@/server/db");
    const { googleCalendars, events } =
      await import("@/server/schema/calendars");

    // Verify event exists
    const eventsBefore = await db
      .select()
      .from(events)
      .where(eq(events.id, testIds.eventId));
    expect(eventsBefore).toHaveLength(1);

    // Delete calendar
    await db
      .delete(googleCalendars)
      .where(eq(googleCalendars.id, testIds.calendarId));

    // Verify event is also deleted
    const eventsAfter = await db
      .select()
      .from(events)
      .where(eq(events.id, testIds.eventId));
    expect(eventsAfter).toHaveLength(0);
  });
});

describe.skipIf(!hasDatabase)("unique user per family constraint", () => {
  const testIds = {
    userId: randomUUID(),
    familyId1: randomUUID(),
    familyId2: randomUUID(),
    memberId1: randomUUID(),
    memberId2: randomUUID(),
  };

  beforeEach(async () => {
    const { db } = await import("@/server/db");
    const { users, families, familyMembers } = await import("@/server/schema");

    await db.insert(users).values({
      id: testIds.userId,
      name: "Test User",
      email: `unique-test-${testIds.userId}@example.com`,
    });

    await db.insert(families).values([
      { id: testIds.familyId1, name: "Family 1" },
      { id: testIds.familyId2, name: "Family 2" },
    ]);

    await db.insert(familyMembers).values({
      id: testIds.memberId1,
      familyId: testIds.familyId1,
      userId: testIds.userId,
      role: "manager",
    });
  });

  afterEach(async () => {
    const { db } = await import("@/server/db");
    const { users, families, familyMembers } = await import("@/server/schema");

    await db
      .delete(familyMembers)
      .where(eq(familyMembers.userId, testIds.userId));
    await db.delete(families).where(eq(families.id, testIds.familyId1));
    await db.delete(families).where(eq(families.id, testIds.familyId2));
    await db.delete(users).where(eq(users.id, testIds.userId));
  });

  it("should prevent user from being in multiple families", async () => {
    const { db } = await import("@/server/db");
    const { familyMembers } = await import("@/server/schema");

    await expect(
      db.insert(familyMembers).values({
        id: testIds.memberId2,
        familyId: testIds.familyId2,
        userId: testIds.userId,
        role: "participant",
      })
    ).rejects.toThrow();
  });
});
