import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before imports
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/pusher", () => ({
  pusherServer: {
    authorizeChannel: vi.fn(() => ({ auth: "mock-auth-token" })),
  },
}));

import { POST } from "../auth/route";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { pusherServer } from "@/lib/pusher";

describe("Pusher Auth Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("socket_id", "123.456");
    formData.append("channel_name", "private-family-test-family-id");

    const request = new Request("http://localhost/api/pusher/auth", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not in the family", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
      session: {},
    } as never);

    // Mock empty family members result
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const formData = new FormData();
    formData.append("socket_id", "123.456");
    formData.append("channel_name", "private-family-other-family-id");

    const request = new Request("http://localhost/api/pusher/auth", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("returns auth token when user belongs to family", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
      session: {},
    } as never);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ familyId: "test-family-id" }]),
        }),
      }),
    } as never);

    const formData = new FormData();
    formData.append("socket_id", "123.456");
    formData.append("channel_name", "private-family-test-family-id");

    const request = new Request("http://localhost/api/pusher/auth", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.auth).toBe("mock-auth-token");
    expect(pusherServer.authorizeChannel).toHaveBeenCalledWith(
      "123.456",
      "private-family-test-family-id"
    );
  });
});
