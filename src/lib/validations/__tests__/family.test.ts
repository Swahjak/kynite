// src/lib/validations/__tests__/family.test.ts
import { describe, it, expect } from "vitest";
import { createChildSchema } from "../family";

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
