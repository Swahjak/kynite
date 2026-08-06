'use client';

import { useTranslations } from 'next-intl';
import { formatCountdown, minutesRemaining, remainingSeconds } from '../domain/countdown';
import type { TimerBoardData, TimerView } from '../page-data';
import { TimerTile } from './timer-tile';
import { useServerNow } from './use-server-now';
import { useTimerChannel } from './use-timer-channel';

/**
 * The running timer as it appears on the ambient board (M09: "the ambient
 * board renders an active timer without navigation").
 *
 * Same channel and same tick as the full timers screen, deliberately: the two
 * surfaces cannot show different seconds because they derive from one place.
 * What differs is restraint — the board is the family's schedule, so at most
 * two timers appear here and neither offers a control. Stopping happens on the
 * timers screen or from the Controller.
 *
 * Renders nothing at all when nothing is running: an empty "no timers" card is
 * furniture on a wall display.
 */
export function AmbientTimers({ board }: { board: TimerBoardData }) {
  const t = useTranslations('timers');
  const { timers, offsetMs } = useTimerChannel(board);
  const now = useServerNow(board.serverNow, offsetMs);

  if (timers.length === 0) return null;

  const copyFor = (timer: TimerView) => ({
    warning: t('warning', { label: timer.label, minutes: minutesRemaining(timer, now) }),
    overrun: t('overrun'),
    remainingLabel: t('remainingLabel', { time: formatCountdown(remainingSeconds(timer, now)) }),
  });

  return (
    <section data-testid="ambient-timers" className="grid gap-3 sm:grid-cols-2">
      {timers.slice(0, 2).map((timer) => (
        <TimerTile key={timer.id} timer={timer} nowMs={now} copy={copyFor(timer)} compact />
      ))}
    </section>
  );
}
