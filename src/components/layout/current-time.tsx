"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useUserPreferences } from "@/hooks/use-preferences";

export function CurrentTime() {
  const [time, setTime] = useState<Date | null>(null);
  const { data: preferences } = useUserPreferences();
  const use24HourFormat = preferences?.use24HourFormat ?? true;

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!time) {
    return null;
  }

  const formattedTime = format(time, use24HourFormat ? "HH:mm" : "h:mm a");

  return (
    <time
      dateTime={time.toISOString()}
      suppressHydrationWarning
      className="text-lg font-semibold tabular-nums"
    >
      {formattedTime}
    </time>
  );
}
