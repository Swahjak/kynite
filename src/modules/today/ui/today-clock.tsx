'use client';

import { useEffect, useRef, useState } from 'react';
import { useDateTimeFormat } from '@/components/formatting';
import { useRouter } from '@/i18n/navigation';
import { hasRolledOver } from '../domain/rollover';

/**
 * The live "12:02, vrijdag 14 augustus 2026" line at the top of `/today`.
 *
 * Two jobs on one tick, because they are the same bug seen from two angles.
 * Before this, the heading was `formatDateTime(data.anchor, ...)` — a plain
 * server-rendered string, true only as of the render that produced it — and
 * `/today`'s only client tick (`NowHeroClock`) fires on the *hero event's* own
 * boundary, never on the household's midnight. A wall-mounted tab left open
 * overnight through a quiet evening (nothing live, nothing realtime) never
 * crosses either boundary, so the heading — and the day's data window, which
 * the route derives from the same server `now` — both freeze on yesterday
 * until *something* happens to refresh the page. That is the bug this fixes.
 *
 * So this component does what `now-hero-clock.tsx` does for an event boundary,
 * for the day boundary instead: it ticks locally to keep the line itself
 * live, and the moment its tick notices the household's local day has moved
 * past `dayKey` it asks the server to render again — once — which is also
 * how the day's events get re-fetched for the new day (`(app)/today/page.tsx`
 * re-derives `anchor` from `new Date()` on every render).
 *
 * `dayKey` is only ever passed when the page is actually showing *today*: a
 * browsed day (`?date=`) must keep reading as that day, not silently jump
 * forward at midnight because a tab happened to be left open on it.
 *
 * Seeded from the server's `now`, exactly like `NowHeroClock` and the shell's
 * `AppClock` — the first client render matches the HTML, so there is no
 * hydration flash.
 */
const TICK_MS = 30_000;

export type TodayClockProps = {
  now: Date;
  timeZone: string;
  /** Household-local `YYYY-MM-DD` the render was seeded with; omit while browsing another day. */
  dayKey?: string;
};

export function TodayClock({ now, timeZone, dayKey }: TodayClockProps) {
  const [current, setCurrent] = useState(now);
  const formatDateTime = useDateTimeFormat();
  const router = useRouter();
  // The boundary is crossed once — the same guard `NowHeroClock` uses, so a
  // slow refresh is not asked for again on every tick until it lands.
  const refreshed = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dayKey || refreshed.current) return;
    if (!hasRolledOver(dayKey, current, timeZone)) return;
    refreshed.current = true;
    router.refresh();
  }, [current, dayKey, timeZone, router]);

  const time = formatDateTime(current, { hour: '2-digit', minute: '2-digit' });
  const date = formatDateTime(current, { dateStyle: 'full' });

  return (
    <time data-testid="today-clock" dateTime={current.toISOString()}>
      {time}, {date}
    </time>
  );
}
