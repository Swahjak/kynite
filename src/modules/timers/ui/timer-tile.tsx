'use client';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
  formatCountdown,
  isWarningDue,
  phaseOf,
  progressRatio,
  remainingSeconds,
} from '../domain/countdown';
import type { TimerView } from '../page-data';
import {
  COUNTDOWN_DIGIT_CLASS,
  COUNTDOWN_DIGIT_CLASS_COMPACT,
  OVERRUN_PULSE_STYLE,
  TIMER_TAP_TARGET_CLASS,
} from './tokens';

/**
 * One countdown, as the board draws it.
 *
 * Presentational on purpose — it takes already-translated strings and an
 * already-corrected `nowMs` rather than reaching for `useTranslations` or
 * `Date.now()`. That is what lets a test render it at any instant and assert
 * the *component's* contract, and it keeps the "which clock is authoritative"
 * decision in exactly one place (`useTimerChannel` → `useServerNow`).
 *
 * Two things it deliberately does not do:
 *
 * - **It never marks the overrun.** A timer that ran out is not late, wrong or
 *   failed; the board states that the time is up, in the same colours it used a
 *   second earlier, and breathes once every 2.4s so a glance still finds it.
 *   No red, no alarm iconography, no flash (research §Decisions 1; the pulse is
 *   bounded by `isNonStrobing`).
 * - **It never addresses anyone.** The label is the thing, not the person:
 *   "Schoenen aan — over 5 minuten", never "doe je schoenen aan" (FR30).
 */

export type TimerTileCopy = {
  /** "Schoenen aan over 5 minuten" — shown only while the warning is live. */
  warning: string | null;
  /** Neutral end-state line, e.g. "Tijd is om". */
  overrun: string;
  /** Accessible name for the countdown, e.g. "Nog 4 minuten 30 seconden". */
  remainingLabel: string;
  /** Accessible name of the stop control. Omitted when there is no control. */
  stopLabel?: string;
};

export type TimerTileProps = {
  timer: TimerView;
  nowMs: number;
  copy: TimerTileCopy;
  compact?: boolean;
  onStop?: () => void;
};

export function TimerTile({ timer, nowMs, copy, compact = false, onStop }: TimerTileProps) {
  const phase = phaseOf(timer, nowMs);
  const left = remainingSeconds(timer, nowMs);
  const warning = isWarningDue(timer, nowMs);
  const ratio = progressRatio(timer, nowMs);

  return (
    <article
      data-testid="timer-tile"
      data-timer-id={timer.id}
      data-phase={phase}
      data-warning={warning ? 'due' : 'none'}
      className={cn(
        'flex flex-col gap-3 rounded-xl bg-surface p-6 ring-1 ring-foreground/10',
        compact && 'gap-2 p-4'
      )}
    >
      <header className="flex items-baseline gap-3">
        <h3
          data-testid="timer-label"
          className={cn(
            'min-w-0 flex-1 truncate font-display font-bold',
            compact ? 'text-h3' : 'text-h2'
          )}
        >
          {timer.label}
        </h3>
        {timer.memberName ? (
          <span data-testid="timer-member" className="shrink-0 text-body text-ink-secondary">
            {timer.memberName}
          </span>
        ) : null}
      </header>

      <p
        data-testid="timer-digits"
        aria-label={copy.remainingLabel}
        // Not through `cn()`: tailwind-merge would treat the Display size as a
        // `text-` colour and drop it (see the note in `./tokens.ts`).
        className={compact ? COUNTDOWN_DIGIT_CLASS_COMPACT : COUNTDOWN_DIGIT_CLASS}
        style={phase === 'overrun' ? OVERRUN_PULSE_STYLE : undefined}
      >
        {formatCountdown(left)}
      </p>

      {/* A single progress line — the six-foot read is the digits; this is the
          peripheral one for a child who cannot yet read them. */}
      <span aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <span
          data-testid="timer-progress"
          className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-brand"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>

      {phase === 'overrun' ? (
        <p data-testid="timer-overrun" className="text-body-lg text-ink-secondary">
          {copy.overrun}
        </p>
      ) : warning && copy.warning ? (
        <p
          data-testid="timer-warning"
          // `polite`, not `assertive`: a transition warning is information the
          // room can take at its own pace, not an interruption.
          aria-live="polite"
          className="flex items-center gap-2 text-body-lg text-ink-secondary"
        >
          <Icon name="timer" size="sm" />
          {copy.warning}
        </p>
      ) : null}

      {onStop && copy.stopLabel ? (
        <button
          type="button"
          data-testid="timer-stop"
          aria-label={copy.stopLabel}
          onClick={onStop}
          className={cn(
            TIMER_TAP_TARGET_CLASS,
            'mt-1 self-start rounded-lg bg-surface-hover px-5 text-body-lg font-medium ring-1 ring-foreground/10',
            'transition-colors duration-200 ease-brand hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50'
          )}
        >
          {copy.stopLabel}
        </button>
      ) : null}
    </article>
  );
}
