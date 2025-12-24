import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("timer-template-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTemplatesForFamily", () => {
    it("returns all active templates for a family", async () => {
      const { db } = await import("@/server/db");
      const mockTemplates = [
        {
          id: "template-1",
          familyId: "family-1",
          title: "Screen Time",
          category: "screen",
          durationSeconds: 1800,
          isActive: true,
        },
        {
          id: "template-2",
          familyId: "family-1",
          title: "Homework",
          category: "activity",
          durationSeconds: 2700,
          isActive: true,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockTemplates),
        }),
      } as never);

      const { getTemplatesForFamily } =
        await import("../timer-template-service");
      const templates = await getTemplatesForFamily("family-1");

      expect(templates).toHaveLength(2);
      expect(templates[0].title).toBe("Screen Time");
    });

    it("returns empty array when no templates exist", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const { getTemplatesForFamily } =
        await import("../timer-template-service");
      const templates = await getTemplatesForFamily("family-1");

      expect(templates).toHaveLength(0);
    });
  });

  describe("getTemplateById", () => {
    it("returns template when found", async () => {
      const { db } = await import("@/server/db");
      const mockTemplate = {
        id: "template-1",
        familyId: "family-1",
        title: "Screen Time",
        durationSeconds: 1800,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockTemplate]),
          }),
        }),
      } as never);

      const { getTemplateById } = await import("../timer-template-service");
      const template = await getTemplateById("template-1", "family-1");

      expect(template).not.toBeNull();
      expect(template?.title).toBe("Screen Time");
    });

    it("returns null when template not found", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const { getTemplateById } = await import("../timer-template-service");
      const template = await getTemplateById("nonexistent", "family-1");

      expect(template).toBeNull();
    });
  });

  describe("createTemplate", () => {
    it("creates template with provided values", async () => {
      const { db } = await import("@/server/db");
      const mockCreated = {
        id: "new-template",
        familyId: "family-1",
        title: "Chore Time",
        category: "chore",
        durationSeconds: 900,
        starReward: 5,
        controlMode: "anyone",
        alertMode: "completion",
        showAsQuickAction: true,
        isActive: true,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCreated]),
        }),
      } as never);

      const { createTemplate } = await import("../timer-template-service");
      const template = await createTemplate("family-1", {
        title: "Chore Time",
        category: "chore",
        durationSeconds: 900,
        starReward: 5,
        controlMode: "anyone",
        alertMode: "completion",
        showAsQuickAction: true,
      });

      expect(template.title).toBe("Chore Time");
      expect(template.starReward).toBe(5);
    });
  });

  describe("deleteTemplate", () => {
    it("soft deletes by setting isActive to false", async () => {
      const { db } = await import("@/server/db");

      // Mock getTemplateById
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "template-1", familyId: "family-1", isActive: true },
              ]),
          }),
        }),
      } as never);

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      vi.mocked(db.update).mockReturnValue(mockUpdate() as never);

      const { deleteTemplate } = await import("../timer-template-service");
      await deleteTemplate("template-1", "family-1");

      expect(db.update).toHaveBeenCalled();
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

      const { deleteTemplate } = await import("../timer-template-service");

      await expect(deleteTemplate("nonexistent", "family-1")).rejects.toThrow(
        "Template not found"
      );
    });
  });
});
