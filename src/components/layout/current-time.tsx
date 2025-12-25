"use client";

import { useState, useEffect } from "react";

export function CurrentTime() {
  const [time, setTime] = useState<Date | null>(null);

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

  const formattedTime = time.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
