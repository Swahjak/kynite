// src/lib/validations/__tests__/family.test.ts
import { describe, it, expect } from "vitest";
import { createChildSchema, updateMemberSchema } from "../family";

describe("createChildSchema", () => {
  it("validates valid input", () => {
    const result = createChildSchema.safeParse({
      name: "Emma",
      avatarColor: "blue",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createChildSchema.safeParse({
      name: "",
      avatarColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 50 chars", () => {
    const result = createChildSchema.safeParse({
      name: "a".repeat(51),
      avatarColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid avatar color", () => {
    const result = createChildSchema.safeParse({
      name: "Emma",
      avatarColor: "magenta",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberSchema", () => {
  describe("avatarSvg", () => {
    it("accepts valid avatarSvg string", () => {
      const result = updateMemberSchema.safeParse({
        avatarSvg:
          '<svg width="100" height="100"><circle cx="50" cy="50" r="40" /></svg>',
      });
      expect(result.success).toBe(true);
    });

    it("accepts null for removal", () => {
      const result = updateMemberSchema.safeParse({
        avatarSvg: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejects strings over 20KB (20000 chars)", () => {
      const result = updateMemberSchema.safeParse({
        avatarSvg: "a".repeat(20001),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("20KB");
      }
    });

    it("accepts strings at exactly 20000 chars", () => {
      const result = updateMemberSchema.safeParse({
        avatarSvg: "a".repeat(20000),
      });
      expect(result.success).toBe(true);
    });
  });
});
