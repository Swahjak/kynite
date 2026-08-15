'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cn } from '@kynite/ui';
import { extendTimerAction, startTimerAction, stopTimerAction } from '../actions';
import {
  EXTEND_PRESET_MINUTES,
  formatCountdown,
  minutesRemaining,
  phaseOf,
  remainingSeconds,
} from '../domain/countdown';
import type { TimerBoardData, TimerView } from '../page-data';
import { TimerTile } from './timer-tile';
import { TIMER_TAP_TARGET_CLASS } from './tokens';
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
/**
 * One "start a timer" button on a surface that may start them (M19).
 *
 * Already translated, like `TimerExtendOption` and for the same reason: this
 * component composes copy from the `timers` namespace, and the kiosk's own
 * chrome copy lives in `hub`. The surface that owns the words passes them in.
 */
export type TimerQuickStart = {
  seconds: number;
  /** Short face of the button, e.g. "5 min". */
  label: string;
  /** The full sentence a screen reader gets. */
  ariaLabel: string;
  /**
   * The name the *started timer* carries — deliberately not `label`.
   *
   * M19 review: the board passed the button's face straight through, so every
   * timer a wall ever started was called "5 min". Two of them on the same board
   * were indistinguishable in the tile heading, in `stopNamed` ("Stop 5 min"),
   * and in the warning line — which is the one place a timer's name has a job.
   */
  startLabel: string;
};

export function TimerBoard({
  board,
  quickStart,
  quickStartTitle,
  atMaximumLabel,
}: {
  board: TimerBoardData;
  /**
   * M19, owner decision: a child at the wall can start a countdown, not only
   * watch one. `timer:control` already grades `allow` for a device principal
   * (§7), so this needed no capability — only a control. Absent, the board is
   * exactly what it was: read, stop, extend.
   */
  quickStart?: readonly TimerQuickStart[];
  quickStartTitle?: string;
  /** Copy for `extendTimerAction`'s `atMaximum` answer — see `TimerTile`. */
  atMaximumLabel?: string;
}) {
  const t = useTranslations('timers');
  const { timers, offsetMs } = useTimerChannel(board);
  const now = useServerNow(board.serverNow, offsetMs);
  const chime = useChime();
  const [, startTransition] = useTransition();
  /**
   * Timers the server has told us are already as long as they get. Kept per
   * timer rather than as one flag: two countdowns on one board are two
   * different questions, and the answer to one is not the answer to the other.
   */
  const [atMaximum, setAtMaximum] = useState<ReadonlySet<string>>(new Set());
  /**
   * Quick-start presets with a start already in flight, keyed by duration.
   *
   * A wall display is tapped by children, and a child taps twice. Without this
   * the second tap of an impatient double-tap is a second, identical timer —
   * the board silently grows a twin nobody asked for, and stopping "the" timer
   * stops one of two. The preset comes back the moment the action settles, so a
   * deliberate second timer is still one tap away; only the accidental one
   * inside the round trip is refused.
   */
  const [starting, setStarting] = useState<ReadonlySet<number>>(new Set());

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

  // FR7 (M18): "a bit longer", from the wall itself. `timer:control` already
  // grades `allow` for a device and for a child on the hub, so this needs no
  // new capability — it is the same authority that stops one.
  const extend = (timerId: string, minutes: number) => {
    startTransition(async () => {
      const result = await extendTimerAction({ timerId, minutes });
      // M19: `atMaximum` is a successful no-op (`action-state.ts`), and until
      // now the board swallowed it — a tap that changed nothing and said
      // nothing. It is stated instead, once, as a fact about the timer.
      if (result.status !== 'atMaximum') return;
      setAtMaximum((previous) => new Set(previous).add(timerId));
    });
  };

  /**
   * `base`, or the first `base n` nobody on this board is already using.
   *
   * Two "5 min timer" rows would be two rows a family cannot tell apart, and
   * the label is what every sentence about a timer is built from. Counting
   * against what is on screen keeps the naming deterministic (no clock, no
   * random suffix) and testable, and it stays quiet in the common case: the
   * first timer of a kind is just "5 min timer".
   */
  const distinctLabel = (base: string) => {
    const taken = new Set(timers.map((timer) => timer.label));
    if (!taken.has(base)) return base;

    for (let n = 2; ; n += 1) {
      const candidate = `${base} ${n}`;
      if (!taken.has(candidate)) return candidate;
    }
  };

  const start = (seconds: number, startLabel: string) => {
    if (starting.has(seconds)) return;
    setStarting((previous) => new Set(previous).add(seconds));

    const label = distinctLabel(startLabel);

    startTransition(async () => {
      try {
        await startTimerAction({
          label,
          durationSeconds: seconds,
          clientId: crypto.randomUUID(),
        });
      } finally {
        setStarting((previous) => {
          const next = new Set(previous);
          next.delete(seconds);
          return next;
        });
      }
    });
  };

  const extendOptionsFor = (timer: TimerView) =>
    EXTEND_PRESET_MINUTES.map((minutes) => ({
      minutes,
      label: t('actions.extend', { minutes }),
      ariaLabel: t('actions.extendNamed', { label: timer.label, minutes }),
    }));

  const copyFor = (timer: TimerView) => ({
    warning: t('warning', { label: timer.label, minutes: minutesRemaining(timer, now) }),
    overrun: t('overrun'),
    remainingLabel: t('remainingLabel', { time: formatCountdown(remainingSeconds(timer, now)) }),
    stopLabel: t('actions.stopNamed', { label: timer.label }),
    atMaximum: atMaximumLabel,
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
              extendOptions={extendOptionsFor(timer)}
              onExtend={(minutes) => extend(timer.id, minutes)}
              atMaximum={atMaximum.has(timer.id)}
            />
          ))}
        </div>
      )}

      {/* M19. Below the running timers, never above them: what is on the wall
          now outranks what could be. */}
      {quickStart && quickStart.length > 0 ? (
        <section data-testid="timer-quick-start" className="flex flex-col gap-3">
          {quickStartTitle ? (
            <h2 className="font-display text-h2 font-bold text-foreground">{quickStartTitle}</h2>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {/* The shared `<Button size="tablet">` — `motion.md`'s "Big tap
                target" specimen: 64px for a primary, high-frequency action on
                the wall kiosk, above the 48px `TIMER_TAP_TARGET_CLASS` floor
                that stays applied on top. */}
            {quickStart.map((option) => (
              <Button
                key={option.seconds}
                type="button"
                variant="outline"
                size="tablet"
                data-testid="timer-quick-start-button"
                data-seconds={option.seconds}
                aria-label={option.ariaLabel}
                disabled={starting.has(option.seconds)}
                onClick={() => start(option.seconds, option.startLabel)}
                className={cn(TIMER_TAP_TARGET_CLASS, 'tabular-time rounded-4xl px-6 text-body-lg')}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
