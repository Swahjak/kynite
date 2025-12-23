import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock star service
vi.mock("../star-service", () => ({
  getBalance: vi.fn(),
  removeStars: vi.fn(),
}));

describe("reward-store-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRewardsForFamily", () => {
    it("returns all active rewards for family", async () => {
      const { db } = await import("@/server/db");
      const mockRewards = [
        { id: "reward-1", title: "Movie Night", starCost: 50, isActive: true },
        { id: "reward-2", title: "Ice Cream", starCost: 20, isActive: true },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRewards),
          }),
        }),
      } as never);

      const { getRewardsForFamily } = await import("../reward-store-service");
      const rewards = await getRewardsForFamily("family-1");

      expect(rewards).toHaveLength(2);
      expect(rewards[0].title).toBe("Movie Night");
    });
  });

  describe("createReward", () => {
    it("creates reward with all fields", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "reward-1",
              familyId: "family-1",
              title: "Movie Night",
              emoji: "🎬",
              starCost: 50,
              limitType: "weekly",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      } as never);

      const { createReward } = await import("../reward-store-service");
      const reward = await createReward("family-1", {
        title: "Movie Night",
        emoji: "🎬",
        starCost: 50,
        limitType: "weekly",
      });

      expect(reward.title).toBe("Movie Night");
      expect(reward.starCost).toBe(50);
    });
  });

  describe("canRedeem", () => {
    it("returns true when balance sufficient and no limits", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(100);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "reward-1",
              starCost: 50,
              limitType: "none",
              isActive: true,
            },
          ]),
        }),
      } as never);

      const { canRedeem } = await import("../reward-store-service");
      const result = await canRedeem("member-1", "reward-1");

      expect(result.canRedeem).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("returns false with reason when balance insufficient", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(30);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "reward-1",
              starCost: 50,
              limitType: "none",
              isActive: true,
            },
          ]),
        }),
      } as never);

      const { canRedeem } = await import("../reward-store-service");
      const result = await canRedeem("member-1", "reward-1");

      expect(result.canRedeem).toBe(false);
      expect(result.reason).toBe("insufficient_stars");
    });

    it("returns false when daily limit reached", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(100);

      // First call: get reward
      // Second call: get redemptions in period
      let callCount = 0;
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([
                {
                  id: "reward-1",
                  starCost: 50,
                  limitType: "daily",
                  isActive: true,
                },
              ]);
            }
            // Already redeemed today
            return {
              orderBy: vi.fn().mockResolvedValue([{ id: "redemption-1" }]),
            };
          }),
        }),
      } as never);

      const { canRedeem } = await import("../reward-store-service");
      const result = await canRedeem("member-1", "reward-1");

      expect(result.canRedeem).toBe(false);
      expect(result.reason).toBe("limit_reached");
    });
  });

  describe("redeemReward", () => {
    it("creates redemption and deducts stars", async () => {
      const { db } = await import("@/server/db");
      const { removeStars } = await import("../star-service");

      vi.mocked(removeStars).mockResolvedValue({
        transaction: { id: "txn-1" } as any,
        newBalance: 50,
      });

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "reward-1",
                  title: "Movie Night",
                  starCost: 50,
                  limitType: "none",
                  isActive: true,
                },
              ]),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                {
                  id: "redemption-1",
                  rewardId: "reward-1",
                  memberId: "member-1",
                  starCost: 50,
                },
              ]),
            }),
          }),
        } as never);
      });

      const { redeemReward } = await import("../reward-store-service");
      const result = await redeemReward("member-1", "reward-1");

      expect(result.redemption.id).toBe("redemption-1");
      expect(result.newBalance).toBe(50);
    });

    it("throws RedemptionError when cannot redeem", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(10);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "reward-1",
              starCost: 50,
              limitType: "none",
              isActive: true,
            },
          ]),
        }),
      } as never);

      const { redeemReward, RedemptionError } =
        await import("../reward-store-service");

      await expect(redeemReward("member-1", "reward-1")).rejects.toBeInstanceOf(
        RedemptionError
      );
    });
  });

  describe("setPrimaryGoal", () => {
    it("sets primary goal for member", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const { setPrimaryGoal } = await import("../reward-store-service");
      await expect(
        setPrimaryGoal("member-1", "reward-1")
      ).resolves.not.toThrow();
    });
  });

  describe("getRedemptionsForMember", () => {
    it("returns redemptions with reward details", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([
                    {
                      redemptions: {
                        id: "r-1",
                        starCost: 50,
                        redeemedAt: new Date(),
                      },
                      rewards: { title: "Movie Night", emoji: "🎬" },
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      } as never);

      const { getRedemptionsForMember } =
        await import("../reward-store-service");
      const result = await getRedemptionsForMember("member-1");

      expect(result).toHaveLength(1);
    });
  });
});
