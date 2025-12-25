import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRewards, useCreateReward } from "../use-rewards";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRewards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches rewards for a family", async () => {
    const mockRewards = [{ id: "1", title: "Ice cream" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { rewards: mockRewards } }),
    });

    const { result } = renderHook(() => useRewards("family-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRewards);
  });
});

describe("useCreateReward", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a reward and invalidates cache", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: "reward-1" } }),
    });

    const { result } = renderHook(() => useCreateReward("family-123"), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      title: "Ice cream",
      emoji: "🍦",
      starCost: 10,
      limitType: "none",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/families/family-123/rewards",
      expect.objectContaining({ method: "POST" })
    );
  });
});
