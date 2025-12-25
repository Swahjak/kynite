import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if CRON_SECRET missing in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.CRON_SECRET;

    await expect(import("../env")).rejects.toThrow("CRON_SECRET");
  });

  it("does not throw if CRON_SECRET present in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "test-secret";

    await expect(import("../env")).resolves.not.toThrow();
  });

  it("does not throw in development without CRON_SECRET", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.CRON_SECRET;

    await expect(import("../env")).resolves.not.toThrow();
  });
});
