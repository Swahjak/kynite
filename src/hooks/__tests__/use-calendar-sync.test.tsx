import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFamilyCalendars, useAddCalendar } from "../use-calendar-sync";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFamilyCalendars", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches family calendars", async () => {
    const mockCalendars = [{ id: "1", name: "Main Calendar" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { calendars: mockCalendars } }),
    });

    const { result } = renderHook(() => useFamilyCalendars("family-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCalendars);
  });
});
