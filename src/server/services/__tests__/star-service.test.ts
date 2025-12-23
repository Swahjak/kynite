import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

describe("star-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBalance", () => {
    it("returns 0 when no balance record exists", async () => {
      const { db } = await import("@/server/db");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const { getBalance } = await import("../star-service");
      const balance = await getBalance("member-123");

      expect(balance).toBe(0);
    });

    it("returns cached balance when record exists", async () => {
      const { db } = await import("@/server/db");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ balance: 42 }]),
        }),
      } as never);

      const { getBalance } = await import("../star-service");
      const balance = await getBalance("member-123");

      expect(balance).toBe(42);
    });
  });

  describe("addStars", () => {
    it("creates transaction and updates balance", async () => {
      const { db } = await import("@/server/db");

      // Mock member lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ id: "member-123", familyId: "family-1" }]),
        }),
      } as never);

      // Mock transaction to execute callback
      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: "txn-1",
                  memberId: "member-123",
                  amount: 5,
                  type: "reward_chart",
                  description: "Brushed teeth",
                  createdAt: new Date(),
                },
              ]),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ balance: 10 }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as never);
      });

      const { addStars } = await import("../star-service");
      const result = await addStars({
        memberId: "member-123",
        amount: 5,
        type: "reward_chart",
        referenceId: "task-1",
        description: "Brushed teeth",
      });

      expect(result.transaction.amount).toBe(5);
      expect(result.newBalance).toBe(15);
    });

    it("throws when amount is zero", async () => {
      const { addStars } = await import("../star-service");

      await expect(
        addStars({
          memberId: "member-123",
          amount: 0,
          type: "bonus",
          description: "Invalid",
        })
      ).rejects.toThrow("Amount cannot be zero");
    });
  });

  describe("removeStars", () => {
    it("creates negative transaction and updates balance", async () => {
      const { db } = await import("@/server/db");

      // Mock member lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ id: "member-123", familyId: "family-1" }]),
        }),
      } as never);

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: "txn-2",
                  memberId: "member-123",
                  amount: -50,
                  type: "redemption",
                  description: "Movie Night",
                  createdAt: new Date(),
                },
              ]),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ balance: 100 }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        } as never);
      });

      const { removeStars } = await import("../star-service");
      const result = await removeStars({
        memberId: "member-123",
        amount: 50,
        type: "redemption",
        referenceId: "reward-1",
        description: "Movie Night",
      });

      expect(result.transaction.amount).toBe(-50);
      expect(result.newBalance).toBe(50);
    });

    it("throws InsufficientStarsError when balance too low", async () => {
      const { db } = await import("@/server/db");

      // Mock member lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([{ id: "member-123", familyId: "family-1" }]),
        }),
      } as never);

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ balance: 10 }]),
            }),
          }),
        } as never);
      });

      const { removeStars, InsufficientStarsError } =
        await import("../star-service");

      await expect(
        removeStars({
          memberId: "member-123",
          amount: 50,
          type: "redemption",
          referenceId: "reward-1",
          description: "Movie Night",
        })
      ).rejects.toBeInstanceOf(InsufficientStarsError);
    });
  });

  describe("getHistory", () => {
    it("returns transactions for member with filters", async () => {
      const { db } = await import("@/server/db");
      const mockTransactions = [
        {
          id: "txn-1",
          amount: 5,
          type: "reward_chart",
          description: "Brushed teeth",
          createdAt: new Date(),
        },
        {
          id: "txn-2",
          amount: -50,
          type: "redemption",
          description: "Movie Night",
          createdAt: new Date(),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(mockTransactions),
              }),
            }),
          }),
        }),
      } as never);

      const { getHistory } = await import("../star-service");
      const history = await getHistory("member-123", { limit: 10, offset: 0 });

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe("reward_chart");
    });
  });
});
