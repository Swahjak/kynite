import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";

// Mock pusher-client before importing hook
const mockBind = vi.fn();
const mockUnbind = vi.fn();
const mockSubscribe = vi.fn(() => ({
  bind: mockBind,
  unbind: mockUnbind,
}));
const mockUnsubscribe = vi.fn();

vi.mock("@/lib/pusher-client", () => ({
  getPusher: vi.fn(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

import { useFamilyChannel } from "../use-family-channel";

describe("useFamilyChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("does nothing when familyId is undefined", () => {
    renderHook(() =>
      useFamilyChannel(undefined, {
        "timer:started": vi.fn(),
      })
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("subscribes to family channel on mount", () => {
    const handler = vi.fn();

    renderHook(() =>
      useFamilyChannel("family-123", {
        "timer:started": handler,
      })
    );

    expect(mockSubscribe).toHaveBeenCalledWith("private-family-family-123");
    expect(mockBind).toHaveBeenCalledWith("timer:started", handler);
  });

  it("unsubscribes on unmount", () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() =>
      useFamilyChannel("family-123", {
        "timer:started": handler,
      })
    );

    unmount();

    expect(mockUnbind).toHaveBeenCalledWith("timer:started");
    expect(mockUnsubscribe).toHaveBeenCalledWith("private-family-family-123");
  });
});
