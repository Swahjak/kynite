'use client';

import { useEffect, useState } from 'react';

/**
 * A clock, for the surfaces that have to know which event is happening *now*.
 *
 * The day board's NOW row is not a fact about an event, it is a fact about the
 * time — and a server-rendered board is a photograph. Without a tick, "NU"
 * stays pinned to whichever event was running when the page was built, which
 * on a wall display means it is wrong for most of the day. That is worse than
 * showing nothing, because a family trusts this screen to be right.
 *
 * Seeded from the server's `now` so the first client render is identical to
 * the HTML and there is no hydration flash — the same bargain
 * `today/ui/now-hero-clock.tsx` strikes, and the same 30s interval for the
 * same reason: a 60s tick started mid-minute lands a boundary up to a full
 * minute late.
 *
 * It re-renders only the component that calls it. Nothing here refetches: the
 * board already has the day's events, and "which of them is running" is a
 * comparison, not a query.
 */
const TICK_MS = 30_000;

export function useNowTick(initialNow?: Date | null): Date | null {
  const [now, setNow] = useState<Date | null>(initialNow ?? null);

  useEffect(() => {
    if (!initialNow) return;

    // No `setNow` on mount: the server's value *is* the current time as of the
    // render, and writing state in an effect is both a lint error here and a
    // second paint nobody asked for. The first tick lands within 30s, which is
    // inside the resolution this board displays anyway.
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, [initialNow]);

  return now;
}

/** True when `now` falls inside the instance. All-day events are never "now". */
export function isCurrent(
  event: { startsAt: Date; endsAt: Date; allDay: boolean },
  now: Date | null
): boolean {
  if (!now || event.allDay) return false;
  const instant = now.getTime();
  return event.startsAt.getTime() <= instant && instant < event.endsAt.getTime();
}
