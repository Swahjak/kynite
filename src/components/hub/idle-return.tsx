'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Idle return-to-board (M19, the `(hub)` half of "thin kiosk shells").
 *
 * A wall display is a shared surface with no owner. A child taps into their
 * routines, finishes, and walks off; the tablet is then showing one child's
 * steps to a household — which is both the wrong information for everyone else
 * and, on a screen that never sleeps, the wrong information *all evening*. So
 * the hub finds its way home on its own.
 *
 * Three deliberate properties:
 *
 *  - **Only away from the board.** The board is the resting state; there is
 *    nothing to return from.
 *  - **`replace`, not `push`.** A kiosk has no history to preserve, and a
 *    growing back stack on a device nobody can press "back" on is a leak.
 *  - **Silent.** No countdown, no "returning in 10…". A child who is mid-tap
 *    resets the timer by touching the screen, and one who has left does not
 *    need to be told the wall moved on.
 *
 * Pinned surfaces are exempt. `?date=`/`?time=`/`?now=` are how the visual
 * suite freezes a screen for a screenshot (`page-data.ts`), and a screen that
 * navigated away mid-capture would be a flake in the one place the product
 * cannot afford one.
 */

/**
 * Three minutes. Long enough that a child working through a routine with
 * pauses is never interrupted, short enough that the wall is the family's
 * board again before anyone next walks past it.
 */
export const HUB_IDLE_TIMEOUT_MS = 180_000;

/**
 * Anything that means a person is *acting on* the screen. `passive`: none of it
 * is handled.
 *
 * Deliberately no `pointermove` and no `wheel`. A wall tablet's digitizer emits
 * `pointermove` from a drifting capacitive reading, a fly, or a sunbeam on the
 * panel — and one such event every three minutes re-arms the timer forever,
 * which turns "returns home on its own" into "returns home only if the room is
 * perfectly still". The three that remain all require a deliberate touch or
 * keystroke, which is the actual question being asked: is somebody using this.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

export function IdleReturn({ timeoutMs = HUB_IDLE_TIMEOUT_MS }: { timeoutMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const pinned = ['date', 'time', 'now'].some((key) => search.get(key) !== null);
  const armed = pathname !== '/hub' && !pinned;

  useEffect(() => {
    if (!armed) return;

    let handle: ReturnType<typeof setTimeout>;

    const arm = () => {
      clearTimeout(handle);
      handle = setTimeout(() => router.replace('/hub'), timeoutMs);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, arm, { passive: true });
    }
    arm();

    return () => {
      clearTimeout(handle);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, arm);
    };
  }, [armed, router, timeoutMs]);

  return null;
}
