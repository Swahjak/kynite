import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

vi.mock("./google-token-service", () => ({
  getValidAccessToken: vi.fn(() => Promise.resolve("mock-token")),
}));

vi.mock("./google-calendar-client", () => ({
  GoogleCalendarClient: vi.fn().mockImplementation(() => ({
    watchEvents: vi.fn(() =>
      Promise.resolve({
        id: "channel-123",
        resourceId: "resource-456",
        expiration: String(Date.now() + 86400000),
      })
    ),
    stopChannel: vi.fn(() => Promise.resolve()),
  })),
}));

describe("google-channel-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWatchChannel", () => {
    it("returns error when GOOGLE_WEBHOOK_BASE_URL not configured", async () => {
      // Dynamically import after mocks are set up
      const originalEnv = process.env.GOOGLE_WEBHOOK_BASE_URL;
      delete process.env.GOOGLE_WEBHOOK_BASE_URL;

      const { createWatchChannel } = await import("../google-channel-service");
      const result = await createWatchChannel("cal-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("GOOGLE_WEBHOOK_BASE_URL");

      process.env.GOOGLE_WEBHOOK_BASE_URL = originalEnv;
    });
  });

  describe("verifyChannelToken", () => {
    it("returns null for non-existent channel", async () => {
      const { verifyChannelToken } = await import("../google-channel-service");
      const result = await verifyChannelToken("invalid-id", "invalid-token");
      expect(result).toBeNull();
    });
  });

  describe("getCalendarIdForChannel", () => {
    it("returns null for non-existent channel", async () => {
      const { getCalendarIdForChannel } =
        await import("../google-channel-service");
      const result = await getCalendarIdForChannel("invalid-id");
      expect(result).toBeNull();
    });
  });
});
