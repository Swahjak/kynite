'use client';

import { useEffect } from 'react';
import { fireConfettiBurst } from '@/components/celebration';

/**
 * One confetti burst, on the morning of a day worth celebrating (M26).
 *
 * Mounted by `TodayHeader`, so both surfaces get it from one place: a parent
 * opening `/today` on Pakjesavond and a family walking past the hub on
 * Koningsdag see the same thing, and neither page had to know about it.
 *
 * Three properties, each of which is the difference between a delight and an
 * irritation:
 *
 * - **Once per day, per device.** `localStorage`, keyed by the day itself —
 *   not per session and not per mount. The hub re-renders on every SSE event a
 *   household generates; a burst per render would fire dozens of times before
 *   breakfast. Per *device* rather than per account is the honest scope for a
 *   wall tablet nobody is signed in on.
 * - **Never on a browsed day.** The caller passes today's key or nothing at
 *   all: paging back to last Christmas is a look at a schedule, not a party.
 * - **Reduced motion is respected**, by `fireConfettiBurst` itself — which also
 *   loads `canvas-confetti` dynamically, so a day with no celebration on it
 *   never pays for the engine.
 *
 * Renders nothing. It is an effect with a mount point, which is why it is a
 * component at all: it has to sit inside a Server-Component tree.
 */

export type HolidayConfettiProps = {
  /** Household-local `YYYY-MM-DD` — the guard key and the reason to fire. */
  dayKey: string;
};

const STORAGE_PREFIX = 'kynite.confetti.';

export function HolidayConfetti({ dayKey }: HolidayConfettiProps) {
  useEffect(() => {
    if (alreadyCelebrated(dayKey)) return;

    // A beat after paint. Confetti that starts in the same frame as the page
    // is confetti nobody sees land, and the hub's first frame is already the
    // busiest one it draws.
    const timer = window.setTimeout(() => {
      fireConfettiBurst({ intensity: 'big', origin: { x: 0.5, y: 0.35 } });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [dayKey]);

  return null;
}

/**
 * Has this device already celebrated `dayKey`? Marks it as celebrated if not.
 *
 * A storage failure (Safari private mode, a kiosk with storage disabled) counts
 * as "not yet": the burst then fires once per page load rather than once per
 * day, which is the friendlier of the two ways to be wrong. Older keys are
 * swept on the way through, so this never grows past today's.
 */
function alreadyCelebrated(dayKey: string): boolean {
  const key = `${STORAGE_PREFIX}${dayKey}`;

  try {
    const seen = window.localStorage.getItem(key) !== null;

    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const stored = window.localStorage.key(index);
      if (stored && stored.startsWith(STORAGE_PREFIX) && stored !== key) {
        window.localStorage.removeItem(stored);
      }
    }

    if (!seen) window.localStorage.setItem(key, '1');
    return seen;
  } catch {
    return false;
  }
}
