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

import { shouldRedactEvent, redactEventDetails } from "../event-service";

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

describe("redactEventDetails", () => {
  const makeFullEvent = () => ({
    id: "event-1",
    familyId: "family-1",
    title: "Doctor Appointment",
    description: "Annual checkup",
    location: "123 Medical Center",
    startTime: new Date("2025-01-15T10:00:00Z"),
    endTime: new Date("2025-01-15T11:00:00Z"),
    allDay: false,
    color: "blue",
    calendarColor: "blue",
    isHidden: false,
    participants: [],
  });

  it("replaces title with 'Hidden'", () => {
    const redacted = redactEventDetails(makeFullEvent());
    expect(redacted.title).toBe("Hidden");
  });

  it("nullifies description", () => {
    const redacted = redactEventDetails(makeFullEvent());
    expect(redacted.description).toBeNull();
  });

  it("nullifies location", () => {
    const redacted = redactEventDetails(makeFullEvent());
    expect(redacted.location).toBeNull();
  });

  it("sets isHidden to true", () => {
    const redacted = redactEventDetails(makeFullEvent());
    expect(redacted.isHidden).toBe(true);
  });

  it("preserves timing information", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.startTime).toEqual(event.startTime);
    expect(redacted.endTime).toEqual(event.endTime);
  });
});
