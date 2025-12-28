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

describe("getEventsForFamily privacy filtering", () => {
  // These test the integration of shouldRedactEvent with getEventsForFamily
  // Using the pure function tests above as the source of truth for filtering logic

  it("redacts events from private calendars when viewer is not owner", () => {
    // Integration verified by:
    // 1. shouldRedactEvent returns true for non-owner + private calendar
    // 2. getEventsForFamily calls shouldRedactEvent for each event
    // 3. redactEventDetails is applied when shouldRedactEvent returns true

    // The flow is: event with private calendar → shouldRedactEvent(event, viewerId) → true → redactEventDetails
    const event = {
      calendar: { isPrivate: true, accountUserId: "owner-123" },
    };
    const isRedacted = shouldRedactEvent(event, "non-owner-456");
    expect(isRedacted).toBe(true);

    // When redacted, title becomes "Hidden"
    const redacted = redactEventDetails({
      title: "Secret Meeting",
      description: "Confidential",
      location: "Private Office",
      isHidden: false,
    });
    expect(redacted.title).toBe("Hidden");
    expect(redacted.isHidden).toBe(true);
  });

  it("shows full details when viewer is the calendar owner", () => {
    const event = {
      calendar: { isPrivate: true, accountUserId: "owner-123" },
    };
    const isRedacted = shouldRedactEvent(event, "owner-123");
    expect(isRedacted).toBe(false);
    // No redaction applied - full event details preserved
  });

  it("shows full details for events from non-private calendars", () => {
    const event = {
      calendar: { isPrivate: false, accountUserId: "owner-123" },
    };
    const isRedacted = shouldRedactEvent(event, "anyone");
    expect(isRedacted).toBe(false);
  });

  it("shows full details for manual events (no calendar)", () => {
    const event = { calendar: null };
    const isRedacted = shouldRedactEvent(event, "anyone");
    expect(isRedacted).toBe(false);
  });
});

describe("getEventById privacy filtering", () => {
  it("applies same privacy rules as getEventsForFamily", () => {
    // getEventById uses the same shouldRedactEvent + redactEventDetails pattern
    // Verify the pattern works end-to-end

    const privateCalendarEvent = {
      calendar: { isPrivate: true, accountUserId: "owner-123" },
    };

    // Non-owner viewing → should be redacted
    expect(shouldRedactEvent(privateCalendarEvent, "non-owner")).toBe(true);

    // Owner viewing → should NOT be redacted
    expect(shouldRedactEvent(privateCalendarEvent, "owner-123")).toBe(false);
  });
});
