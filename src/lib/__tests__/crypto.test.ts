import { describe, it, expect } from "vitest";
import { secureCompare } from "../crypto";

describe("secureCompare", () => {
  it("returns true for identical strings", () => {
    expect(secureCompare("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(secureCompare("abc123", "xyz789")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(secureCompare("short", "muchlonger")).toBe(false);
  });

  it("returns false when either string is empty", () => {
    expect(secureCompare("", "nonempty")).toBe(false);
    expect(secureCompare("nonempty", "")).toBe(false);
  });

  it("handles special characters", () => {
    const token = "abc+/=123";
    expect(secureCompare(token, token)).toBe(true);
  });
});
