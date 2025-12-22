"use client";

import { useState, useEffect } from "react";

export function useClock(updateInterval = 1000): Date {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, updateInterval);

    return () => clearInterval(timer);
  }, [updateInterval]);

  return time;
}

export type TimeOfDay = "morning" | "afternoon" | "evening";

export function useGreeting(currentTime: Date): TimeOfDay {
  const hour = currentTime.getHours();

  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
