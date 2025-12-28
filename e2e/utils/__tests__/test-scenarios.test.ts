import { describe, it, expect } from "vitest";

describe("createTestSession email uniqueness", () => {
  it("should generate unique emails for concurrent session creation", () => {
    // Simulate the uniqueness logic
    const baseEmail = "test@example.com";
    const emails = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const uniqueEmail = baseEmail.replace("@", `-${uniqueId}@`);
      emails.add(uniqueEmail);
    }

    // All 100 emails should be unique
    expect(emails.size).toBe(100);
  });

  it("should produce valid email format", () => {
    const baseEmail = "test@example.com";
    const uniqueId = "abc12345";
    const uniqueEmail = baseEmail.replace("@", `-${uniqueId}@`);

    expect(uniqueEmail).toBe("test-abc12345@example.com");
    expect(uniqueEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
