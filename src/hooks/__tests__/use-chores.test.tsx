import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChores, useCompleteChore, useCreateChore } from "../use-chores";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useChores", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches chores for a family", async () => {
    const mockChores = [{ id: "1", title: "Clean room" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { chores: mockChores } }),
    });

    const { result } = renderHook(() => useChores("family-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChores);
  });
});

describe("useCompleteChore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("completes a chore and invalidates cache", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    const { result } = renderHook(() => useCompleteChore("family-123"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("chore-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/families/family-123/chores/chore-1/complete",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useCreateChore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a chore with correct payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: "new-chore" } }),
    });

    const { result } = renderHook(() => useCreateChore("family-123"), {
      wrapper: createWrapper(),
    });

    const newChore = {
      title: "New Chore",
      recurrence: "once" as const,
      isUrgent: false,
      starReward: 10,
    };

    result.current.mutate(newChore);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/families/family-123/chores",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(newChore),
      })
    );
  });
});
