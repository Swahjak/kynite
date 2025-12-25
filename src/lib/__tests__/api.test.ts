// src/lib/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "../api";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns data on successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: "123" } }),
    });

    const result = await apiFetch("/api/test");
    expect(result).toEqual({ id: "123" });
  });

  it("throws ApiError on unsuccessful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: "NOT_FOUND", message: "Resource not found" },
        }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
    await expect(apiFetch("/api/test")).rejects.toThrow("Resource not found");
  });

  it("includes Content-Type header for POST/PUT/PATCH", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    await apiFetch("/api/test", { method: "POST", body: JSON.stringify({}) });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });
});
