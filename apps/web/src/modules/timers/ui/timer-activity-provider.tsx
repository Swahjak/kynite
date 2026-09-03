'use client';

import { useState, type ReactNode } from 'react';
import { TimerActivityContext } from '@/components/hub';
import type { TimerBoardData } from '../page-data';
import { useTimerChannel } from './use-timer-channel';

/**
 * Bridges this slice's live timer channel into `TimerActivityContext`
 * (M-T2) — the one thing `components/hub/idle-return.tsx` needs and may not
 * read directly (see that context's own doc comment for why).
 *
 * Mounted once, by `(hub)/layout.tsx`, wrapping the whole kiosk shell —
 * `IdleReturn` sits several client layers below it (`KioskShell` → this),
 * and Context crosses that distance for free where a prop would have to be
 * threaded through every layer in between just to reach the one component
 * that cares.
 */
export function TimerActivityProvider({
  initial,
  children,
}: {
  initial: TimerBoardData | null;
  children: ReactNode;
}) {
  // A device with no board yet (`initial === null`) still has to call the
  // hook — React's rules don't allow skipping it — so it gets a frozen,
  // empty one: nothing to subscribe to, nothing ever exempts `IdleReturn`.
  const [frozenNow] = useState(() => Date.now());
  const board = initial ?? { familyId: '', serverNow: frozenNow, timers: [], frozen: true };
  const { timers } = useTimerChannel(board);

  return (
    <TimerActivityContext.Provider value={timers.length > 0}>
      {children}
    </TimerActivityContext.Provider>
  );
}
