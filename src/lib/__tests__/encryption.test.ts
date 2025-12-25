/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("encryption", () => {
  const originalEnv = process.env;
  const TEST_KEY = "k1.aesgcm256.q1D1YdqUzElia0hZIqKrFeGUs7dY1poAH87PcQ28YfE=";

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encryptToken", () => {
    it("encrypts a token successfully", async () => {
      const { encryptToken } = await import("../encryption");
      const token = "ya29.test-access-token";
      const encrypted = encryptToken(token);

      expect(encrypted).not.toBe(token);
      expect(encrypted).toContain("."); // Cloak format includes dots
    });

    it("produces different ciphertext each time (random IV)", async () => {
      const { encryptToken } = await import("../encryption");
      const token = "ya29.test-access-token";

      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("throws if TOKEN_ENCRYPTION_KEY is not set", async () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      const { encryptToken } = await import("../encryption");

      expect(() => encryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    });
  });

  describe("decryptToken", () => {
    it("decrypts an encrypted token back to original", async () => {
      const { encryptToken, decryptToken } = await import("../encryption");
      const original = "ya29.test-access-token";

      const encrypted = encryptToken(original);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(original);
    });

    it("throws on invalid ciphertext", async () => {
      const { decryptToken } = await import("../encryption");

      expect(() => decryptToken("invalid-ciphertext")).toThrow();
    });

    it("throws if TOKEN_ENCRYPTION_KEY is not set", async () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      const { decryptToken } = await import("../encryption");

      expect(() => decryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted values", async () => {
      const { encryptToken, isEncrypted } = await import("../encryption");
      const encrypted = encryptToken("test-token");

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("returns false for plain text", async () => {
      const { isEncrypted } = await import("../encryption");

      expect(isEncrypted("ya29.plain-access-token")).toBe(false);
      expect(isEncrypted("1//refresh-token")).toBe(false);
    });
  });
});
