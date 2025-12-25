// src/server/services/__tests__/child-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/server/db", () => ({
  db: {
    transaction: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

describe("child-service", () => {
  describe("module exports", () => {
    it("exports createChildMember function", async () => {
      const { createChildMember } = await import("../child-service");
      expect(typeof createChildMember).toBe("function");
    });

    it("exports countChildrenInFamily function", async () => {
      const { countChildrenInFamily } = await import("../child-service");
      expect(typeof countChildrenInFamily).toBe("function");
    });

    it("exports createUpgradeToken function", async () => {
      const { createUpgradeToken } = await import("../child-service");
      expect(typeof createUpgradeToken).toBe("function");
    });

    it("exports getUpgradeToken function", async () => {
      const { getUpgradeToken } = await import("../child-service");
      expect(typeof getUpgradeToken).toBe("function");
    });

    it("exports upgradeChildToAccount function", async () => {
      const { upgradeChildToAccount } = await import("../child-service");
      expect(typeof upgradeChildToAccount).toBe("function");
    });
  });
});
