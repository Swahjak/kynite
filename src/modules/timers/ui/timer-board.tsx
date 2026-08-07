'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { stopTimerAction } from '../actions';
import { formatCountdown, minutesRemaining, phaseOf, remainingSeconds } from '../domain/countdown';
import type { TimerBoardData, TimerView } from '../page-data';
import { TimerTile } from './timer-tile';
import { useChime } from './use-chime';
import { useServerNow } from './use-server-now';
import { useTimerChannel } from './use-timer-channel';

/**
 * The hub timers screen (`(hub)/hub/timers`), and the assembly point for the
 * three pieces the slice is built from:
 *
 * 1. `useTimerChannel` — what is running, and how wrong this device's clock is.
 *    Polling today, SSE in M10; nothing below this line knows the difference.
 * 2. `useServerNow` — the local tick, aligned to the server's whole second.
 * 3. `TimerTile` — the drawing, which is given an instant and never asks for one.
 *
 * The chime fires exactly once per timer, on the frame it crosses into
 * overrun, and only if a user gesture has already unlocked audio. A hub that
 * boots with three expired timers on it therefore makes no sound at all — the
 * "already over when I arrived" case is not an event.
 *
 * The chime *controls* are not here. M09 put them at the bottom of this board
 * and the M09 review called it furniture: a volume slider that is touched twice
 * a year had permanent residence on a wall display, at child height. M12 moved
 * them behind the kiosk shell's settings corner (`components/hub`), where the
 * setting is still one tap away but is not part of what the room looks at. The
 * `useChime()` store is shared through localStorage, so the control and the
 * sound stay in agreement without either knowing about the other.
 */
export function TimerBoard({ board }: { board: TimerBoardData }) {
  const t = useTranslations('timers');
  const { timers, offsetMs } = useTimerChannel(board);
  const now = useServerNow(board.serverNow, offsetMs);
  const chime = useChime();
  const [, startTransition] = useTransition();

  // Which timers have already sounded. Seeded on mount with everything that is
  // *already* over, so arriving late never triggers a chime.
  const chimed = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (chimed.current === null) {
      chimed.current = new Set(
        timers.filter((timer) => phaseOf(timer, now) === 'overrun').map((timer) => timer.id)
      );
      return;
    }

    for (const timer of timers) {
      if (phaseOf(timer, now) !== 'overrun' || chimed.current.has(timer.id)) continue;
      chimed.current.add(timer.id);
      chime.play();
    }
  }, [timers, now, chime]);

  const stop = (timerId: string) => {
    startTransition(async () => {
      await stopTimerAction({ timerId });
    });
  };

  const copyFor = (timer: TimerView) => ({
    warning: t('warning', { label: timer.label, minutes: minutesRemaining(timer, now) }),
    overrun: t('overrun'),
    remainingLabel: t('remainingLabel', { time: formatCountdown(remainingSeconds(timer, now)) }),
    stopLabel: t('actions.stopNamed', { label: timer.label }),
  });

  return (
    <div data-testid="timer-board" className="flex flex-col gap-6">
      {timers.length === 0 ? (
        <p data-testid="timer-board-empty" className="text-body-lg text-ink-secondary">
          {t('empty')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {timers.map((timer) => (
            <TimerTile
              key={timer.id}
              timer={timer}
              nowMs={now}
              copy={copyFor(timer)}
              onStop={() => stop(timer.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
