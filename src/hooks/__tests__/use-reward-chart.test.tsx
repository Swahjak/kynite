import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRewardChartWeek, useCompleteTask } from "../use-reward-chart";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRewardChartWeek", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches weekly chart data", async () => {
    const mockData = { childName: "Test", weekStart: "2025-01-01" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockData }),
    });

    const { result } = renderHook(
      () => useRewardChartWeek("family-123", "chart-456"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});

describe("useCompleteTask", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("completes a task and invalidates cache", async () => {
    const mockResponse = {
      completion: { id: "comp-1", taskId: "task-1", status: "completed" },
      goalProgress: null,
      starsEarned: 1,
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockResponse }),
    });

    const { result } = renderHook(
      () => useCompleteTask("family-123", "chart-456"),
      { wrapper: createWrapper() }
    );

    result.current.mutate("task-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/families/family-123/reward-charts/chart-456/tasks/task-1/complete",
      expect.objectContaining({ method: "POST" })
    );
  });
});
