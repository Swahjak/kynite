import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClock, useGreeting } from "../hooks";

describe("useGreeting", () => {
  it("returns morning for hours before 12", () => {
    const morning = new Date("2024-01-01T08:00:00");
    const { result } = renderHook(() => useGreeting(morning));
    expect(result.current).toBe("morning");
  });

  it("returns afternoon for hours 12-17", () => {
    const afternoon = new Date("2024-01-01T14:00:00");
    const { result } = renderHook(() => useGreeting(afternoon));
    expect(result.current).toBe("afternoon");
  });

  it("returns evening for hours 18+", () => {
    const evening = new Date("2024-01-01T20:00:00");
    const { result } = renderHook(() => useGreeting(evening));
    expect(result.current).toBe("evening");
  });
});

describe("useClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current time", () => {
    const { result } = renderHook(() => useClock());
    expect(result.current).toBeInstanceOf(Date);
  });

  it("updates every interval", () => {
    const { result } = renderHook(() => useClock(1000));
    const initialTime = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.getTime()).toBeGreaterThan(initialTime);
  });
});
