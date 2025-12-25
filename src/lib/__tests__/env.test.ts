import { describe, it, expect, vi, beforeEach } from "vitest";

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Create a new object with mutable properties
    const envCopy = { ...originalEnv };
    Object.defineProperty(process, "env", {
      value: envCopy,
      writable: true,
      configurable: true,
    });
  });

  it("throws if CRON_SECRET missing in production", async () => {
    const envCopy: Record<string, string | undefined> = {
      ...originalEnv,
      NODE_ENV: "production",
    };
    delete envCopy.CRON_SECRET;
    Object.defineProperty(process, "env", {
      value: envCopy,
      writable: true,
      configurable: true,
    });

    await expect(import("../env")).rejects.toThrow("CRON_SECRET");
  });

  it("does not throw if CRON_SECRET present in production", async () => {
    const envCopy = {
      ...originalEnv,
      NODE_ENV: "production",
      CRON_SECRET: "test-secret",
    };
    Object.defineProperty(process, "env", {
      value: envCopy,
      writable: true,
      configurable: true,
    });

    await expect(import("../env")).resolves.not.toThrow();
  });

  it("does not throw in development without CRON_SECRET", async () => {
    const envCopy: Record<string, string | undefined> = {
      ...originalEnv,
      NODE_ENV: "development",
    };
    delete envCopy.CRON_SECRET;
    Object.defineProperty(process, "env", {
      value: envCopy,
      writable: true,
      configurable: true,
    });

    await expect(import("../env")).resolves.not.toThrow();
  });
});
