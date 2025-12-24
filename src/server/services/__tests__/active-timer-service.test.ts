import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock star-service to avoid circular dependency issues
vi.mock("../star-service", () => ({
  addStars: vi.fn().mockResolvedValue({
    transaction: { id: "txn-1", amount: 10 },
    newBalance: 50,
  }),
}));

describe("active-timer-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getActiveTimersForFamily", () => {
    it("returns all running timers for a family", async () => {
      const { db } = await import("@/server/db");
      const mockTimers = [
        {
          id: "timer-1",
          familyId: "family-1",
          title: "Screen Time",
          status: "running",
          remainingSeconds: 900,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockTimers),
        }),
      } as never);

      const { getActiveTimersForFamily } =
        await import("../active-timer-service");
      const timers = await getActiveTimersForFamily("family-1");

      expect(timers).toHaveLength(1);
      expect(timers[0].status).toBe("running");
    });
  });

  describe("getTimerById", () => {
    it("returns timer when found", async () => {
      const { db } = await import("@/server/db");
      const mockTimer = {
        id: "timer-1",
        familyId: "family-1",
        title: "Homework",
        status: "running",
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTimer]),
          }),
        }),
      } as never);

      const { getTimerById } = await import("../active-timer-service");
      const timer = await getTimerById("timer-1", "family-1");

      expect(timer).not.toBeNull();
      expect(timer?.title).toBe("Homework");
    });

    it("returns null when timer not found", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const { getTimerById } = await import("../active-timer-service");
      const timer = await getTimerById("nonexistent", "family-1");

      expect(timer).toBeNull();
    });
  });

  describe("startTimerFromTemplate", () => {
    it("creates timer from template", async () => {
      const { db } = await import("@/server/db");

      // Mock template lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "template-1",
                familyId: "family-1",
                title: "Screen Time",
                description: "iPad time",
                category: "screen",
                durationSeconds: 1800,
                starReward: 0,
                alertMode: "completion",
                cooldownSeconds: null,
              },
            ]),
          }),
        }),
      } as never);

      const mockCreated = {
        id: "timer-1",
        familyId: "family-1",
        templateId: "template-1",
        title: "Screen Time",
        status: "running",
        remainingSeconds: 1800,
        durationSeconds: 1800,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreated]),
        }),
      } as never);

      const { startTimerFromTemplate } =
        await import("../active-timer-service");
      const timer = await startTimerFromTemplate("family-1", {
        templateId: "template-1",
        assignedToId: "member-1",
        deviceId: "device-123",
      });

      expect(timer.title).toBe("Screen Time");
      expect(timer.status).toBe("running");
    });

    it("throws when template not found", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const { startTimerFromTemplate } =
        await import("../active-timer-service");

      await expect(
        startTimerFromTemplate("family-1", {
          templateId: "nonexistent",
          assignedToId: "member-1",
          deviceId: "device-123",
        })
      ).rejects.toThrow("Template not found");
    });
  });

  describe("pauseTimer", () => {
    it("pauses a running timer from owner device", async () => {
      const { db } = await import("@/server/db");

      // Mock getTimerById
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "timer-1",
                familyId: "family-1",
                status: "running",
                ownerDeviceId: "device-123",
              },
            ]),
          }),
        }),
      } as never);

      const mockUpdated = {
        id: "timer-1",
        status: "paused",
        pausedAt: new Date(),
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      } as never);

      const { pauseTimer } = await import("../active-timer-service");
      const timer = await pauseTimer("timer-1", "family-1", "device-123");

      expect(timer.status).toBe("paused");
    });

    it("throws when not owner device", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "timer-1",
                familyId: "family-1",
                status: "running",
                ownerDeviceId: "device-123",
              },
            ]),
          }),
        }),
      } as never);

      const { pauseTimer } = await import("../active-timer-service");

      await expect(
        pauseTimer("timer-1", "family-1", "different-device")
      ).rejects.toThrow("Not the owner device");
    });

    it("throws when timer not running", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "timer-1",
                familyId: "family-1",
                status: "paused",
                ownerDeviceId: "device-123",
              },
            ]),
          }),
        }),
      } as never);

      const { pauseTimer } = await import("../active-timer-service");

      await expect(
        pauseTimer("timer-1", "family-1", "device-123")
      ).rejects.toThrow("Timer is not running");
    });
  });

  describe("cancelTimer", () => {
    it("marks timer as cancelled", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "timer-1", familyId: "family-1", status: "running" },
              ]),
          }),
        }),
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const { cancelTimer } = await import("../active-timer-service");
      await cancelTimer("timer-1", "family-1");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("confirmTimer", () => {
    it("confirms timer and awards stars", async () => {
      const { db } = await import("@/server/db");
      const { addStars } = await import("../star-service");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "timer-1",
                familyId: "family-1",
                title: "Chore Timer",
                status: "expired",
                starReward: 10,
                assignedToId: "member-1",
                completedAt: new Date(),
                cooldownSeconds: 300,
              },
            ]),
          }),
        }),
      } as never);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "timer-1",
                status: "completed",
                confirmedById: "parent-1",
              },
            ]),
          }),
        }),
      } as never);

      const { confirmTimer } = await import("../active-timer-service");
      const result = await confirmTimer("timer-1", "family-1", {
        confirmedById: "parent-1",
      });

      expect(result.timer.status).toBe("completed");
      expect(result.starsAwarded).toBe(10);
      expect(addStars).toHaveBeenCalledWith({
        memberId: "member-1",
        amount: 10,
        type: "timer",
        referenceId: "timer-1",
        description: "Chore Timer",
      });
    });

    it("throws when timer not awaiting confirmation", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "timer-1", familyId: "family-1", status: "running" },
              ]),
          }),
        }),
      } as never);

      const { confirmTimer } = await import("../active-timer-service");

      await expect(
        confirmTimer("timer-1", "family-1", { confirmedById: "parent-1" })
      ).rejects.toThrow("Timer is not awaiting confirmation");
    });
  });
});
