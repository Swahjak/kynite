import { describe, it, expect } from "vitest";
import { FAMILY_MEMBER_ROLES, AVATAR_COLORS } from "../family";

describe("family types", () => {
  it("includes child role", () => {
    expect(FAMILY_MEMBER_ROLES).toContain("child");
  });

  it("has all expected roles", () => {
    expect(FAMILY_MEMBER_ROLES).toEqual([
      "manager",
      "participant",
      "caregiver",
      "child",
    ]);
  });
});
