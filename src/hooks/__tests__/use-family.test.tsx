import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateFamily, useAddChild, useCreateInvite } from "../use-family";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCreateFamily", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a family", async () => {
    const mockFamily = { id: "fam-1", name: "Test Family" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { family: mockFamily } }),
    });

    const { result } = renderHook(() => useCreateFamily(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Test Family" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
