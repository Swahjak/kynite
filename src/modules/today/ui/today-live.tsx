'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useRealtimeEvents, useRealtimeResync } from '@/components/realtime';

/**
 * Keeps `/today` current without a reload.
 *
 * The whole page is a server render — the NOW hero, the Up Next grid and the
 * Kids' Progress panel are all Server Components reading the database — so
 * "stay live" here means `router.refresh()`, exactly as `RoutineBoard` does it
 * (`modules/routines/ui/routine-board.tsx:119`). Rendering nothing at all is
 * the point: this is a subscription, not a widget, and hanging it off a
 * zero-output component keeps every other piece of the page a server one.
 *
 * The five event types are the ones this page draws: the calendar half feeds
 * the hero and the grid, the routine/star half feeds the sidebar. A resync
 * (the stream reconnecting after a gap it could not replay) refreshes too — a
 * board that silently stopped updating is the failure mode that matters on a
 * screen a family trusts to be right.
 *
 * Note this is *additive*: before M19 `/today` had no realtime at all and a
 * completed step only appeared on the next navigation.
 *
 * The refresh is **coalesced**. Realtime here arrives in bursts, not singly: a
 * child ticking off an eight-step morning routine emits eight `completion`
 * events inside a few seconds, and a Google sync pushes a whole day of
 * `event.upserted` at once. One `router.refresh()` per event is one full server
 * render of this page per event — the hero, the grid, the progress panel and
 * their queries — for a result that is identical after the last one. A trailing
 * debounce turns a burst into one or two renders and costs the family at most
 * `REFRESH_DEBOUNCE_MS` of staleness, which is well under the time it takes to
 * look up at the screen.
 */

/** Trailing window; long enough to swallow a routine burst, short enough to feel live. */
const REFRESH_DEBOUNCE_MS = 1_000;

export function TodayLive() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  // A pending refresh must not fire into an unmounted tree.
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useRealtimeEvents(
    [
      'event.upserted',
      'event.deleted',
      'completion.created',
      'completion.undone',
      'stars.awarded',
      // The Takenlijst is the household's list, not one person's: a parent
      // ticking something off on a phone has to strike it through on the
      // tablet in the kitchen without anybody touching it.
      'task.upserted',
      'task.deleted',
    ],
    refresh
  );

  useRealtimeResync(refresh);

  return null;
}
