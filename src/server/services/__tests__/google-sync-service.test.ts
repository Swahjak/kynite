import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  performInitialSync,
  performIncrementalSync,
} from "../google-sync-service";

// Mock dependencies
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../google-token-service", () => ({
  getValidAccessToken: vi.fn(),
}));

vi.mock("../google-calendar-client", () => ({
  GoogleCalendarClient: vi.fn().mockImplementation(() => ({
    listEvents: vi.fn(),
  })),
  GoogleCalendarApiError: class GoogleCalendarApiError extends Error {
    constructor(
      public status: number,
      public apiError: { error: { message: string } }
    ) {
      super(apiError.error.message);
    }
    get requiresFullSync() {
      return this.status === 410;
    }
  },
}));

describe("google-sync-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performInitialSync", () => {
    it("returns error when calendar not found", async () => {
      const { db } = await import("@/server/db");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const result = await performInitialSync("nonexistent");

      expect(result.error).toBe("Calendar not found");
      expect(result.eventsCreated).toBe(0);
      expect(result.eventsUpdated).toBe(0);
      expect(result.eventsDeleted).toBe(0);
    });

    it("returns error when token is invalid", async () => {
      const { db } = await import("@/server/db");
      const { getValidAccessToken } = await import("../google-token-service");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "cal1",
                accountId: "acc1",
                googleCalendarId: "primary",
                familyId: "fam1",
              },
            ]),
          }),
        }),
      } as never);

      vi.mocked(getValidAccessToken).mockResolvedValue(null);

      const result = await performInitialSync("cal1");

      expect(result.error).toBe("Invalid token");
      expect(result.eventsCreated).toBe(0);
      expect(result.eventsUpdated).toBe(0);
      expect(result.eventsDeleted).toBe(0);
    });
  });

  describe("performIncrementalSync", () => {
    it("falls back to initial sync when no sync cursor", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "cal1",
                accountId: "acc1",
                googleCalendarId: "primary",
                familyId: "fam1",
                syncCursor: null,
              },
            ]),
          }),
        }),
      } as never);

      // This will call performInitialSync internally, which will fail with "Invalid token"
      // because we haven't mocked getValidAccessToken
      const result = await performIncrementalSync("cal1");

      // Verify it attempted initial sync (falls back when no syncCursor)
      expect(result.calendarId).toBe("cal1");
      // Should have error because no token is mocked for the fallback initial sync
      expect(result.error).toBe("Invalid token");
    });
  });
});
