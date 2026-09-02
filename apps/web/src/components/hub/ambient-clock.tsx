'use client';

import { useEffect, useState } from 'react';
import { cn } from '@kynite/ui';
import { useDateTimeFormat } from '@/components/formatting';

/**
 * Same cadence `TodayClock` ticks at (`modules/today/ui/today-clock.tsx`): a
 * minute display only ever needs to notice it crossed a minute boundary, and
 * 30s guarantees that without a per-second re-render nobody is reading.
 */
const TICK_MS = 30_000;

export type AmbientClockProps = {
  /** The server's render instant, so the first client tick matches the HTML. */
  now: Date;
  className?: string;
};

/**
 * The wall's ambient screensaver face (`/hub/clock`, Fully Kiosk's screensaver
 * URL) — Nest-Hub-style: one huge time, the date spelled out beneath it,
 * nothing else. Unlike `TodayClock` this never asks for a day-rollover
 * refresh: a screensaver has no `dayKey`-scoped data window to keep in sync,
 * only a clock face to keep honest, and `router.refresh()` would flash the
 * screen kiosk mode exists to avoid.
 */
export function AmbientClock({ now, className }: AmbientClockProps) {
  const [current, setCurrent] = useState(now);
  const formatDateTime = useDateTimeFormat();

  useEffect(() => {
    const timer = setInterval(() => setCurrent(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const time = formatDateTime(current, { hour: '2-digit', minute: '2-digit' });
  const date = formatDateTime(current, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div
      data-testid="ambient-clock"
      className={cn('flex flex-col items-center gap-3 text-center', className)}
    >
      <time
        dateTime={current.toISOString()}
        className="font-display text-display-xl font-extrabold tabular-nums text-white"
      >
        {time}
      </time>
      <span className="text-h3 font-medium text-white/60">{date}</span>
    </div>
  );
}
