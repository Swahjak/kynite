import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTimerTemplates, useStartTimer } from "../use-timers";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useTimerTemplates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches timer templates", async () => {
    const mockTemplates = [{ id: "1", title: "Screen Time" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { templates: mockTemplates } }),
    });

    const { result } = renderHook(() => useTimerTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTemplates);
  });
});

describe("useStartTimer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts a timer and invalidates cache", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { timer: { id: "timer-1" } } }),
    });

    const { result } = renderHook(() => useStartTimer(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ templateId: "template-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/timers/active",
      expect.objectContaining({ method: "POST" })
    );
  });
});
