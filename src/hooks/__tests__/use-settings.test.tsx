import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLinkedAccounts, useDevices } from "../use-settings";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLinkedAccounts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches linked accounts", async () => {
    const mockAccounts = [{ id: "1", provider: "google" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { accounts: mockAccounts } }),
    });

    const { result } = renderHook(() => useLinkedAccounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAccounts);
  });
});

describe("useDevices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches devices", async () => {
    const mockDevices = [{ id: "1", name: "Living Room Display" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { devices: mockDevices } }),
    });

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockDevices);
  });
});
