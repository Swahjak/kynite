'use client';

import { createContext } from 'react';

/**
 * "Is at least one timer running on this device's family right now?" —
 * nothing more. `IdleReturn` reads it (M-T2) to stay off `/hub/timer` while
 * a countdown is live; nothing else in `components/hub` needs it yet.
 *
 * A plain boolean context rather than the timers slice's own
 * `useTimerChannel`/`TimerBoardData` because `IdleReturn` lives in
 * `components/hub`, outside `modules/timers`, and a client component out
 * here may not import that slice's barrel — it re-exports `server-only`
 * reads alongside its client pieces, and pulling either into this bundle
 * fails the build (the same rule `TodayFab`'s own doc comment states for
 * `modules/calendar`/`modules/tasks`). This file stays deliberately
 * timers-agnostic — no import from `modules/timers` anywhere in it — so nothing
 * here trips that rule. `modules/timers/ui/timer-activity-provider.tsx` is the
 * one place that reads a live timer channel and writes into this context; it
 * imports *this* module (a plain React context, no slice boundary to cross),
 * never the other way around.
 */
export const TimerActivityContext = createContext(false);
