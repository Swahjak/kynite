import { describe, it, expect, vi } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { shouldRedactEvent } from "../event-service";

describe("shouldRedactEvent", () => {
  const makeEvent = (overrides: {
    calendarIsPrivate?: boolean;
    calendarAccountUserId?: string;
  }) => ({
    id: "event-1",
    title: "Test Event",
    calendar:
      overrides.calendarIsPrivate !== undefined
        ? {
            isPrivate: overrides.calendarIsPrivate,
            accountUserId: overrides.calendarAccountUserId ?? "owner-123",
          }
        : null,
  });

  describe("when calendar is not private", () => {
    it("returns false - no redaction needed", () => {
      const event = makeEvent({ calendarIsPrivate: false });
      expect(shouldRedactEvent(event, "anyone")).toBe(false);
    });
  });

  describe("when calendar is private", () => {
    it("returns false when viewer is the calendar owner", () => {
      const event = makeEvent({
        calendarIsPrivate: true,
        calendarAccountUserId: "owner-123",
      });
      expect(shouldRedactEvent(event, "owner-123")).toBe(false);
    });

    it("returns true when viewer is NOT the calendar owner", () => {
      const event = makeEvent({
        calendarIsPrivate: true,
        calendarAccountUserId: "owner-123",
      });
      expect(shouldRedactEvent(event, "other-user")).toBe(true);
    });

    it("returns true when no viewer is provided", () => {
      const event = makeEvent({
        calendarIsPrivate: true,
        calendarAccountUserId: "owner-123",
      });
      expect(shouldRedactEvent(event, undefined)).toBe(true);
    });
  });

  describe("when event has no calendar", () => {
    it("returns false - manual events are never private", () => {
      const event = makeEvent({});
      expect(shouldRedactEvent(event, "anyone")).toBe(false);
    });
  });
});
